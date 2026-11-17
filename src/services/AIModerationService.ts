import { createHash } from 'node:crypto';
import { PermissionFlagsBits, type Guild, type GuildMember, type Message } from 'discord.js';
import { AIIncidentRepo } from '../database/repositories/index.js';
import { AI_LIMITS } from '../config/constants.js';
import type { GuildAIConfig } from '../config/aiCategories.js';
import type { AIAction } from '../config/aiCategories.js';
import { BotError } from '../core/errors/BotError.js';
import { decide, type PrimaryDecision } from '../ai/decision.js';
import type { AIClassifier } from '../ai/AIClassifier.js';
import { BoundedTaskQueue } from '../ai/queue.js';
import { SlidingWindowLimiter } from '../ai/rateLimiter.js';
import type { ClassificationResult } from '../ai/types.js';
import { aiIncidentEmbed, selfHarmAlertEmbed } from '../ui/embeds/ai.js';
import { truncate } from '../utils/text.js';
import { TtlCache } from '../utils/cache.js';
import { childLogger } from '../utils/logger.js';
import type { ActionMarkers } from './ActionMarkers.js';
import type { AIConfigService } from './AIConfigService.js';
import type { BlockedWordService } from './BlockedWordService.js';
import type { BotSettingsService } from './BotSettingsService.js';
import type { LoggingService } from './LoggingService.js';
import type { ModerationService } from './ModerationService.js';

const log = childLogger('ai-moderation');

interface Outcome { taken: AIAction; result: string; caseNumber: number | null }

export class AIModerationService {
  private readonly queue: BoundedTaskQueue;
  private readonly limiter = new SlidingWindowLimiter(AI_LIMITS.guildRateMax, AI_LIMITS.guildRateWindowMs);
  private readonly dedupe = new TtlCache<true>(AI_LIMITS.dedupeMs, 20_000);
  private readonly logThrottle = new Map<string, number>();
  readonly stats = { scanned: 0, skippedRateLimit: 0, skippedQueueFull: 0, failOpen: 0, flagged: 0 };

  constructor(
    private readonly configs: AIConfigService,
    private readonly blockedWords: BlockedWordService,
    private readonly botSettings: BotSettingsService,
    private readonly classifier: AIClassifier,
    private readonly moderation: ModerationService,
    private readonly logging: LoggingService,
    private readonly markers: ActionMarkers,
  ) {
    this.queue = new BoundedTaskQueue({ concurrency: AI_LIMITS.concurrency, maxSize: AI_LIMITS.queueMax, onError: (err) => log.error({ err }, 'unexpected error in AI task') });
  }

  /** Entry point from messageCreate / messageUpdate. Never throws, never blocks the event loop on the provider. */
  async handleMessage(message: Message): Promise<void> {
    try {
      if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
      const text = message.content?.trim();
      if (!text) return;
      const cfg = await this.configs.get(message.guildId);
      if (!cfg.enabled) return;
      if (cfg.scopeChannelIds.length > 0 && !this.channelMatches(message, cfg.scopeChannelIds)) return;
      const member = message.member;
      if (!member || this.isExempt(message, member, cfg)) return;

      // 1) Local deterministic blocked words: work even when the AI provider is down.
      const hit = (await this.blockedWords.matcher(message.guildId)).find(text);
      if (hit) {
        await this.act(message, cfg, { source: 'blocked_word', category: `blocked:${hit.term}`, action: cfg.blockedWordAction, configuredAction: cfg.blockedWordAction, score: null, confidence: null, downgradeReason: null, text });
        return;
      }

      // 2) AI path: guards, then hand off to the bounded queue and return immediately.
      if (text.length < AI_LIMITS.minTextChars) return;
      const aiText = truncate(text, AI_LIMITS.maxTextChars, '');
      const key = `${message.guildId}:${message.author.id}:${createHash('sha1').update(aiText).digest('hex')}`;
      if (this.dedupe.get(key)) return;
      this.dedupe.set(key, true);
      if (!this.limiter.tryAcquire(message.guildId)) { this.stats.skippedRateLimit++; return; } // fail-open: skip
      if (!this.queue.enqueue(() => this.process(message, aiText))) { this.stats.skippedQueueFull++; } // fail-open: skip
    } catch (err) {
      log.error({ err, guildId: message.guildId }, 'AI moderation guard failed (ignored)');
    }
  }

  private channelMatches(message: Message<true>, ids: string[]): boolean {
    return ids.includes(message.channelId) || (!!message.channel.isThread() && !!message.channel.parentId && ids.includes(message.channel.parentId));
  }

  private isExempt(message: Message<true>, member: GuildMember, cfg: GuildAIConfig): boolean {
    if (member.id === message.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (cfg.exemptUserIds.includes(member.id)) return true;
    if (this.channelMatches(message, cfg.exemptChannelIds)) return true;
    return member.roles.cache.some((r) => cfg.exemptRoleIds.includes(r.id));
  }

  private async process(message: Message<true>, text: string): Promise<void> {
    this.stats.scanned++;
    const cfg = await this.configs.get(message.guildId);
    if (!cfg.enabled) return;
    const sel = await this.botSettings.getAI();
    const res: ClassificationResult = await this.classifier.classify(sel.provider, sel.model, text);
    if (!res.ok) {
      // FAIL-OPEN (fixed, non-configurable): no moderation action of any kind. Log internally, throttled.
      this.stats.failOpen++;
      const k = `${res.provider}:${res.reason}`;
      const now = Date.now();
      if (now - (this.logThrottle.get(k) ?? 0) > 30_000) {
        this.logThrottle.set(k, now);
        log.warn({ provider: res.provider, reason: res.reason, detail: res.detail }, 'AI classification failed; failing open (no action taken)');
      }
      return;
    }
    const decision = decide(res.scores, res.confidence, cfg);
    if (decision.selfHarm) await this.alertSelfHarm(message, cfg, text, decision.selfHarm.score, res);
    if (decision.primary) {
      this.stats.flagged++;
      const p: PrimaryDecision = decision.primary;
      await this.act(message, cfg, {
        source: 'ai', category: p.category, action: p.action, configuredAction: p.configuredAction, score: p.score, confidence: res.confidence,
        downgradeReason: p.downgradeReason, text, provider: res.provider, model: res.model, scores: res.scores,
      });
    }
  }

  private async botMember(guild: Guild): Promise<GuildMember | null> {
    return guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  }

  private async act(
    original: Message<true>,
    cfg: GuildAIConfig,
    d: {
      source: 'ai' | 'blocked_word'; category: string; action: AIAction; configuredAction: AIAction; score: number | null; confidence: number | null;
      downgradeReason: string | null; text: string; provider?: string; model?: string; scores?: Record<string, number>;
    },
  ): Promise<void> {
    try {
      // Never act on stale content: the message may have been deleted or edited while we waited.
      const fresh = await original.channel.messages.fetch(original.id).catch(() => null);
      if (!fresh || fresh.content !== original.content) return;
      const out = await this.apply(fresh as Message<true>, cfg, d);
      await this.record(fresh as Message<true>, cfg, d, out);
    } catch (err) {
      log.error({ err, guildId: original.guildId }, 'failed to act on AI decision (ignored)');
    }
  }

  private async tryDelete(message: Message<true>): Promise<string> {
    try {
      this.markers.mark(message.guildId, 'aiDelete', message.id, { moderatorId: message.client.user.id, reason: 'AI moderation' });
      await message.delete();
      return 'message deleted';
    } catch (err) {
      return `delete failed (${(err as { code?: unknown })?.code ?? 'error'})`;
    }
  }

  private async apply(message: Message<true>, cfg: GuildAIConfig, d: { action: AIAction; category: string; score: number | null; source: 'ai' | 'blocked_word' }): Promise<Outcome> {
    if (d.action === 'log') return { taken: 'log', result: 'logged only', caseNumber: null };
    if (d.action === 'delete') return { taken: 'delete', result: await this.tryDelete(message), caseNumber: null };

    // warn / timeout: acts as the BOT, so Discord perms + role hierarchy are checked by ModerationService.
    const bot = await this.botMember(message.guild);
    const target = message.member;
    if (!bot || !target) return { taken: d.action, result: 'skipped: member unavailable', caseNumber: null };
    const reason = d.source === 'blocked_word' ? 'AI moderation: blocked word' : `AI moderation: ${d.category} (score ${d.score?.toFixed(2)})`;
    const ctx = { guild: message.guild, actor: bot, reason, source: d.source === 'blocked_word' ? ('blocked_word' as const) : ('ai' as const), metadata: { aiCategory: d.category } };
    let result: string;
    let caseNumber: number | null = null;
    try {
      const r = d.action === 'warn' ? await this.moderation.warn(ctx, target) : await this.moderation.timeout(ctx, target, cfg.timeoutSeconds * 1000);
      caseNumber = r.case.caseNumber;
      result = d.action === 'warn' ? 'user warned' : 'user timed out';
    } catch (err) {
      result = err instanceof BotError ? `denied (${err.detail ?? err.code})` : 'failed';
      if (!(err instanceof BotError)) log.error({ err }, 'AI punitive action failed');
    }
    if (cfg.deleteOnPunish) result += `; ${await this.tryDelete(message)}`;
    return { taken: d.action, result, caseNumber };
  }

  private async record(
    message: Message<true>,
    cfg: GuildAIConfig,
    d: { source: 'ai' | 'blocked_word'; category: string; configuredAction: AIAction; score: number | null; confidence: number | null; text: string; provider?: string; model?: string; scores?: Record<string, number>; downgradeReason: string | null },
    out: Outcome,
  ): Promise<void> {
    const excerpt = truncate(d.text, AI_LIMITS.excerptMax);
    await AIIncidentRepo.create(message.guildId, {
      userId: message.author.id, channelId: message.channelId, messageId: message.id, source: d.source, provider: d.provider ?? null, model: d.model ?? null,
      scores: d.scores ?? null, confidence: d.confidence, category: d.category, score: d.score, configuredAction: d.configuredAction, actionTaken: out.taken, actionResult: out.result,
      excerpt, caseNumber: out.caseNumber,
    }).catch((err) => log.error({ err }, 'failed to persist AI incident'));
    if (cfg.logChannelId) {
      await this.logging.sendToChannel(message.guild, cfg.logChannelId, aiIncidentEmbed({
        userId: message.author.id, channelId: message.channelId, messageUrl: out.taken === 'delete' ? null : message.url, source: d.source, category: d.category, score: d.score, confidence: d.confidence,
        configuredAction: d.configuredAction, actionTaken: out.taken, actionResult: out.result, excerpt, provider: d.provider, model: d.model, downgradeReason: d.downgradeReason, caseNumber: out.caseNumber,
      }));
    }
  }

  /** Alert-only: no deletion, no DM, no punishment, ever. */
  private async alertSelfHarm(original: Message<true>, cfg: GuildAIConfig, text: string, score: number, res: Extract<ClassificationResult, { ok: true }>): Promise<void> {
    try {
      const excerpt = truncate(text, AI_LIMITS.excerptMax);
      await AIIncidentRepo.create(original.guildId, {
        userId: original.author.id, channelId: original.channelId, messageId: original.id, source: 'ai', provider: res.provider, model: res.model, scores: res.scores,
        confidence: res.confidence, category: 'self_harm', score, configuredAction: 'log', actionTaken: 'log', actionResult: 'alert sent (alert-only)', excerpt, caseNumber: null,
      }).catch((err) => log.error({ err }, 'failed to persist AI incident'));
      const channelId = cfg.alertChannelId ?? cfg.logChannelId;
      if (channelId) await this.logging.sendToChannel(original.guild, channelId, selfHarmAlertEmbed({ userId: original.author.id, channelId: original.channelId, messageUrl: original.url, score, excerpt }));
    } catch (err) {
      log.error({ err }, 'self-harm alert failed (ignored)');
    }
  }

  get queueDepth(): number { return this.queue.size; }
  async shutdown(): Promise<void> { await this.queue.drain(5000); }
}
