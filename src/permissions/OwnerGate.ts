import { getEnv } from '../config/env.js';
import { OWNER_AUDIT_DEDUPE_MS } from '../config/constants.js';
import { BotError } from '../core/errors/BotError.js';
import { TtlCache } from '../utils/cache.js';
import { childLogger } from '../utils/logger.js';
import type { AuditService } from '../services/AuditService.js';
import { resolveConfigAccess } from './ownerAccess.js';
import type { ConfigPanel } from './types.js';

const log = childLogger('owner-gate');

/**
 * The ONLY module that reads the owner setting.
 *  - canAccessConfigPanel(): owner may bypass the ZiuuX config-panel access check (audited).
 *  - assertOwner(): gate for /botsettings.
 * It is never consulted for moderation: see PermissionService, which has no owner concept.
 */
export class OwnerGate {
  private readonly recentBypass = new TtlCache<true>(OWNER_AUDIT_DEDUPE_MS, 1000);

  constructor(
    private readonly ownerId: string,
    private readonly audit: AuditService,
  ) {}

  static fromEnv(audit: AuditService): OwnerGate {
    return new OwnerGate(getEnv().BOT_OWNER_ID, audit);
  }

  isOwner(userId: string): boolean {
    return userId === this.ownerId;
  }

  assertOwner(userId: string): void {
    if (!this.isOwner(userId)) throw new BotError('owner_only', 'This command is restricted to the bot owner.');
  }

  async canAccessConfigPanel(i: { userId: string; guildId: string; panel: ConfigPanel; discordAllowed: boolean }): Promise<boolean> {
    const r = resolveConfigAccess({ userId: i.userId, ownerId: this.ownerId, discordAllowed: i.discordAllowed });
    if (r.viaOwnerBypass) {
      const key = `${i.userId}:${i.guildId}:${i.panel}`;
      if (!this.recentBypass.get(key)) {
        this.recentBypass.set(key, true);
        this.audit.recordPanelBypass(i.userId, i.guildId, i.panel).catch((err) => log.error({ err }, 'failed to write owner bypass audit'));
      }
    }
    return r.allowed;
  }
}
