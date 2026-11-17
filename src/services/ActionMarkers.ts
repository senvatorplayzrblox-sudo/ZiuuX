import { MARKER_TTL_MS } from '../config/constants.js';
import { TtlCache } from '../utils/cache.js';

export type MarkerKind = 'ban' | 'unban' | 'timeout' | 'purge' | 'aiDelete';
export interface MarkerInfo { moderatorId: string; caseNumber?: number; reason?: string | null }

/**
 * Short-lived, in-memory attribution for actions ZiuuX itself just performed, so the native-event log
 * (ban / unban / timeout / delete) can name the moderator and case without waiting for the audit log.
 * Losing a marker is harmless: the log falls back to the audit log.
 */
export class ActionMarkers {
  private readonly cache = new TtlCache<MarkerInfo>(MARKER_TTL_MS, 5000);
  private key = (guildId: string, kind: MarkerKind, subjectId: string) => `${guildId}:${kind}:${subjectId}`;

  mark(guildId: string, kind: MarkerKind, subjectId: string, info: MarkerInfo): void {
    this.cache.set(this.key(guildId, kind, subjectId), info);
  }
  peek(guildId: string, kind: MarkerKind, subjectId: string): MarkerInfo | undefined {
    return this.cache.get(this.key(guildId, kind, subjectId));
  }
  /** Attach the case number once it is known. */
  update(guildId: string, kind: MarkerKind, subjectId: string, patch: Partial<MarkerInfo>): void {
    const cur = this.peek(guildId, kind, subjectId);
    if (cur) this.cache.set(this.key(guildId, kind, subjectId), { ...cur, ...patch });
  }
}
