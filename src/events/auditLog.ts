import { AuditLogEvent, PermissionFlagsBits, type Guild } from 'discord.js';
import { sleep } from '../utils/time.js';

export interface Executor { moderatorId: string | null; reason: string | null }

/** Best-effort lookup of who performed an action. Needs View Audit Log; never throws. */
export async function findExecutor(guild: Guild, type: AuditLogEvent, targetId: string, waitMs = 700): Promise<Executor> {
  const none: Executor = { moderatorId: null, reason: null };
  try {
    const me = guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.ViewAuditLog)) return none;
    if (waitMs) await sleep(waitMs); // audit entries can lag the gateway event slightly
    const logs = await guild.fetchAuditLogs({ type, limit: 6 });
    const entry = logs.entries.find((e) => e.targetId === targetId && Date.now() - e.createdTimestamp < 15_000);
    return entry ? { moderatorId: entry.executorId ?? null, reason: entry.reason ?? null } : none;
  } catch {
    return none;
  }
}
