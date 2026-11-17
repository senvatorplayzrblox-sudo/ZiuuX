import { AuditLogEvent, Events } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { findExecutor } from '../auditLog.js';
import { banLog, memberJoinLog, memberLeaveLog, memberRolesLog, timeoutLog } from '../../ui/embeds/log.js';

export const memberAdd = defineEvent({
  name: Events.GuildMemberAdd,
  async execute(client, member) {
    const s = client.services;
    await s.logging.send(member.guild, 'memberJoin', memberJoinLog({ userId: member.id, tag: member.user.tag, createdAt: member.user.createdAt, memberCount: member.guild.memberCount, avatarUrl: member.displayAvatarURL({ size: 128 }) }));
  },
});

export const memberRemove = defineEvent({
  name: Events.GuildMemberRemove,
  async execute(client, member) {
    const roles = member.partial ? [] : [...member.roles.cache.keys()].filter((id) => id !== member.guild.id);
    await client.services.logging.send(member.guild, 'memberLeave', memberLeaveLog({ userId: member.id, tag: member.user.tag, joinedAt: member.joinedAt, roles, avatarUrl: member.user.displayAvatarURL({ size: 128 }) }));
  },
});

export const banAdd = defineEvent({
  name: Events.GuildBanAdd,
  async execute(client, ban) {
    const s = client.services;
    if (!(await s.logging.isConfigured(ban.guild.id, 'ban'))) return;
    const full = ban.partial ? await ban.fetch().catch(() => ban) : ban;
    const marker = s.markers.peek(ban.guild.id, 'ban', ban.user.id);
    const ex = marker ? { moderatorId: marker.moderatorId, reason: marker.reason ?? null } : await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await s.logging.send(ban.guild, 'ban', banLog({ userId: ban.user.id, tag: ban.user.tag, reason: marker?.reason ?? full.reason ?? ex.reason, moderatorId: ex.moderatorId, caseNumber: marker?.caseNumber ?? null }));
  },
});

export const banRemove = defineEvent({
  name: Events.GuildBanRemove,
  async execute(client, ban) {
    const s = client.services;
    if (!(await s.logging.isConfigured(ban.guild.id, 'unban'))) return;
    const marker = s.markers.peek(ban.guild.id, 'unban', ban.user.id);
    const ex = marker ? { moderatorId: marker.moderatorId, reason: marker.reason ?? null } : await findExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await s.logging.send(ban.guild, 'unban', banLog({ userId: ban.user.id, tag: ban.user.tag, reason: marker?.reason ?? ex.reason, moderatorId: ex.moderatorId, caseNumber: marker?.caseNumber ?? null, unban: true }));
  },
});

export const memberUpdate = defineEvent({
  name: Events.GuildMemberUpdate,
  async execute(client, oldMember, newMember) {
    if (oldMember.partial) return; // cannot diff without the previous state
    const s = client.services;
    const guild = newMember.guild;

    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp && (await s.logging.isConfigured(guild.id, 'timeout'))) {
      const until = newMember.isCommunicationDisabled() ? newMember.communicationDisabledUntil : null;
      const marker = s.markers.peek(guild.id, 'timeout', newMember.id);
      const ex = marker ? { moderatorId: marker.moderatorId, reason: marker.reason ?? null } : await findExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
      await s.logging.send(guild, 'timeout', timeoutLog({ userId: newMember.id, tag: newMember.user.tag, until, moderatorId: ex.moderatorId, reason: marker?.reason ?? ex.reason, caseNumber: marker?.caseNumber ?? null }));
    }

    const before = new Set(oldMember.roles.cache.keys());
    const after = new Set(newMember.roles.cache.keys());
    const added = [...after].filter((r) => !before.has(r));
    const removed = [...before].filter((r) => !after.has(r));
    if ((added.length || removed.length) && (await s.logging.isConfigured(guild.id, 'roleChange'))) {
      const ex = await findExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      await s.logging.send(guild, 'roleChange', memberRolesLog({ userId: newMember.id, tag: newMember.user.tag, added, removed, moderatorId: ex.moderatorId }));
    }
  },
});
