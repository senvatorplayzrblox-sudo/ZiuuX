import type { Guild } from 'discord.js';
import { BotError } from '../../core/errors/BotError.js';
import { assertCommandAllowed, assertConfigAccess, resolveGuildActor } from '../../core/access.js';
import { deferPanel, editView, notify } from '../../core/respond.js';
import type { ComponentCtx, ModuleHandler } from '../../core/registry/InteractionRegistry.js';
import { isAICategory, type AICategory } from '../../config/aiCategories.js';
import { LIMITS } from '../../config/constants.js';
import { isSensitivity } from '../../config/aiCategories.js';
import { buildCustomId } from '../../interactions/customId.js';
import { modal } from '../../ui/components/builders.js';
import { renderAIView, isSection, wordId, type Section } from '../../ui/panels/aimod/views.js';
import { successEmbed, warnEmbed } from '../../ui/embeds/base.js';
import { parseDuration } from '../../utils/duration.js';

const expired = () => new BotError('not_found', 'This panel has expired. Please run /aimod again.');

function parseThreshold(raw: string): number {
  const n = Number(raw.replace('%', '').trim());
  if (!Number.isFinite(n)) throw new BotError('invalid_input', 'Threshold must be a number, e.g. `0.8` or `80`.');
  return n > 1 ? n / 100 : n;
}

async function checkedChannelIds(guild: Guild, ids: string[], s: ComponentCtx['client']['services']): Promise<string[]> {
  for (const id of ids) {
    const ch = guild.channels.cache.get(id);
    if (!ch) throw new BotError('not_found', 'One of the selected channels could not be found.');
    s.logging.assertChannelUsable(guild, ch);
  }
  return ids;
}

export const aimodHandler: ModuleHandler = {
  async handle({ client, interaction, action, args }: ComponentCtx) {
    const s = client.services;
    const actor = await resolveGuildActor(interaction);
    await assertConfigAccess(s, actor, 'aimod'); // re-checked on EVERY interaction
    await assertCommandAllowed(s, actor, 'aimod', interaction);
    const { guild } = actor;
    const gid = guild.id;
    const values = interaction.isAnySelectMenu() ? interaction.values : [];
    const render = (section: Section, opts = {}) => renderAIView(s, guild, section, opts);

    // ---- Interactions that OPEN a modal must not be deferred ----
    if (interaction.isStringSelectMenu() && action === 'thrpick') {
      const cat = values[0];
      if (!isAICategory(cat)) throw expired();
      const cfg = await s.aiConfig.get(gid);
      await interaction.showModal(modal(buildCustomId('am', 'mthr', cat), `Threshold: ${cat}`, [
        { id: 'value', label: 'Threshold (0.05 - 0.99, or 5 - 99 %)', required: true, min: 1, max: 5, value: cfg.categories[cat].threshold.toFixed(2), placeholder: '0.80' },
      ]));
      return;
    }
    if (interaction.isButton() && action === 'timeoutbtn') {
      const cfg = await s.aiConfig.get(gid);
      await interaction.showModal(modal(buildCustomId('am', 'mtimeout'), 'AI timeout length', [
        { id: 'value', label: 'Duration (1m - 24h), e.g. 10m, 1h', required: true, max: 10, value: `${Math.round(cfg.timeoutSeconds / 60)}m` },
      ]));
      return;
    }
    if (interaction.isButton() && action === 'bwadd') {
      await interaction.showModal(modal(buildCustomId('am', 'mbwadd'), 'Add blocked words', [
        { id: 'terms', label: 'Words/phrases (one per line or comma-separated)', style: 'paragraph', required: true, max: 1000 },
        { id: 'mode', label: 'Match mode: word or contains', required: false, max: 8, value: 'word', placeholder: 'word' },
      ]));
      return;
    }

    // ---- Modal submissions ----
    if (interaction.isModalSubmit()) {
      await deferPanel(interaction);
      if (action === 'mthr') {
        const cat = args[0];
        if (!isAICategory(cat)) throw expired();
        await s.aiConfig.setThreshold(gid, cat, parseThreshold(interaction.fields.getTextInputValue('value')));
        await editView(interaction, await render('detection'));
      } else if (action === 'mtimeout') {
        const ms = parseDuration(interaction.fields.getTextInputValue('value'));
        if (ms === null) throw new BotError('invalid_input', 'Invalid duration. Use units like `10m` or `1h`.');
        await s.aiConfig.setTimeoutSeconds(gid, Math.round(ms / 1000));
        await editView(interaction, await render('actions'));
      } else if (action === 'mbwadd') {
        const mode = interaction.fields.getTextInputValue('mode').trim().toLowerCase() || 'word';
        if (mode !== 'word' && mode !== 'contains') throw new BotError('invalid_input', 'Match mode must be `word` or `contains`.');
        const terms = interaction.fields.getTextInputValue('terms').split(/[\n,]+/).map((t) => t.trim()).filter(Boolean).slice(0, 25);
        const r = await s.blockedWords.add(gid, terms, mode, actor.member.id);
        await editView(interaction, await render('words'));
        await notify(interaction, successEmbed(`Added **${r.added}**, duplicates **${r.duplicates}**, rejected **${r.rejected}** (empty or longer than ${LIMITS.blockedWordMaxLen} characters${r.limitReached ? `, or the ${LIMITS.blockedWordsMax}-word limit was reached` : ''}).`, 'Blocked words'));
      } else throw expired();
      return;
    }

    await deferPanel(interaction);
    switch (action) {
      case 'nav': {
        const section = values[0];
        if (!isSection(section)) throw expired();
        await editView(interaction, await render(section));
        return;
      }
      case 'show': {
        const section = args[0];
        if (!isSection(section)) throw expired();
        await editView(interaction, await render(section));
        return;
      }
      case 'toggle': {
        const cfg = await s.aiConfig.get(gid);
        const next = !cfg.enabled;
        await s.aiConfig.setEnabled(gid, next);
        if (next) {
          const sel = await s.botSettings.getAI();
          if (!s.providers.isConfigured(sel.provider)) await notify(interaction, warnEmbed('AI moderation is enabled, but the selected provider has no API key configured, so only blocked words will work until the bot owner fixes it.'));
        }
        await editView(interaction, await render('overview'));
        return;
      }
      case 'sens': {
        const v = values[0];
        if (!isSensitivity(v)) throw expired();
        await s.aiConfig.setSensitivity(gid, v);
        await editView(interaction, await render('detection'));
        return;
      }
      case 'cats': {
        await s.aiConfig.setCategoriesEnabled(gid, values.filter(isAICategory) as AICategory[]);
        await editView(interaction, await render('detection'));
        return;
      }
      case 'actpick': {
        const cat = values[0];
        if (!isAICategory(cat)) throw expired();
        await editView(interaction, await render('actions', { category: cat }));
        return;
      }
      case 'act': {
        const cat = args[0];
        if (!isAICategory(cat) || !values[0]) throw expired();
        await s.aiConfig.setAction(gid, cat, values[0]);
        await editView(interaction, await render('actions'));
        return;
      }
      case 'bwact': {
        await s.aiConfig.setBlockedWordAction(gid, values[0] ?? '');
        await editView(interaction, await render('actions'));
        return;
      }
      case 'dop': {
        const cfg = await s.aiConfig.get(gid);
        await s.aiConfig.setDeleteOnPunish(gid, !cfg.deleteOnPunish);
        await editView(interaction, await render('actions'));
        return;
      }
      case 'bwrm': {
        const id = values[0];
        const word = (await s.blockedWords.list(gid)).find((w) => wordId(w.normalized) === id);
        if (word) await s.blockedWords.remove(gid, word.normalized);
        await editView(interaction, await render('words', { page: Number(args[0]) || 0 }));
        return;
      }
      case 'bwpage':
        await editView(interaction, await render('words', { page: Number(args[0]) || 0 }));
        return;
      case 'inc':
        await editView(interaction, await render('incidents', { page: Number(args[0]) || 0 }));
        return;
      case 'alertch':
        await s.aiConfig.setChannel(gid, 'alert', values[0] ? (await checkedChannelIds(guild, [values[0]], s))[0]! : null);
        await editView(interaction, await render('channels'));
        return;
      case 'logch':
        await s.aiConfig.setChannel(gid, 'log', values[0] ? (await checkedChannelIds(guild, [values[0]], s))[0]! : null);
        await editView(interaction, await render('channels'));
        return;
      case 'scope':
        await s.aiConfig.setScope(gid, values);
        await editView(interaction, await render('channels'));
        return;
      case 'clearalert':
        await s.aiConfig.setChannel(gid, 'alert', null);
        await editView(interaction, await render('channels'));
        return;
      case 'clearlog':
        await s.aiConfig.setChannel(gid, 'log', null);
        await editView(interaction, await render('channels'));
        return;
      case 'clearscope':
        await s.aiConfig.setScope(gid, []);
        await editView(interaction, await render('channels'));
        return;
      case 'exroles':
        await s.aiConfig.setExemptions(gid, 'roles', values);
        await editView(interaction, await render('exempt'));
        return;
      case 'exch':
        await s.aiConfig.setExemptions(gid, 'channels', values);
        await editView(interaction, await render('exempt'));
        return;
      case 'exusers':
        await s.aiConfig.setExemptions(gid, 'users', values);
        await editView(interaction, await render('exempt'));
        return;
      default:
        throw expired();
    }
  },
};

