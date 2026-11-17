import { AuditLogEvent, ChannelType, Events, type GuildChannel, type Role } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { findExecutor } from '../auditLog.js';
import { channelLog, roleLog } from '../../ui/embeds/log.js';

const roleChanges = (o: Role, n: Role): string[] => {
  const c: string[] = [];
  if (o.name !== n.name) c.push(`Name: ${o.name} → ${n.name}`);
  if (o.color !== n.color) c.push(`Color: ${o.hexColor} → ${n.hexColor}`);
  if (o.hoist !== n.hoist) c.push(`Hoisted: ${o.hoist} → ${n.hoist}`);
  if (o.mentionable !== n.mentionable) c.push(`Mentionable: ${o.mentionable} → ${n.mentionable}`);
  const added = o.permissions.missing(n.permissions);
  const removed = n.permissions.missing(o.permissions);
  if (added.length) c.push(`Permissions added: ${added.join(', ')}`);
  if (removed.length) c.push(`Permissions removed: ${removed.join(', ')}`);
  return c;
};

export const roleCreate = defineEvent({
  name: Events.GuildRoleCreate,
  async execute(client, role) {
    const s = client.services;
    if (!(await s.logging.isConfigured(role.guild.id, 'roleChange'))) return;
    const ex = await findExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    await s.logging.send(role.guild, 'roleChange', roleLog({ kind: 'created', roleId: role.id, name: role.name, changes: [], moderatorId: ex.moderatorId }));
  },
});

export const roleDelete = defineEvent({
  name: Events.GuildRoleDelete,
  async execute(client, role) {
    const s = client.services;
    if (!(await s.logging.isConfigured(role.guild.id, 'roleChange'))) return;
    const ex = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    await s.logging.send(role.guild, 'roleChange', roleLog({ kind: 'deleted', roleId: role.id, name: role.name, changes: [], moderatorId: ex.moderatorId }));
  },
});

export const roleUpdate = defineEvent({
  name: Events.GuildRoleUpdate,
  async execute(client, oldRole, newRole) {
    const changes = roleChanges(oldRole, newRole);
    if (!changes.length) return;
    const s = client.services;
    if (!(await s.logging.isConfigured(newRole.guild.id, 'roleChange'))) return;
    const ex = await findExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await s.logging.send(newRole.guild, 'roleChange', roleLog({ kind: 'updated', roleId: newRole.id, name: newRole.name, changes, moderatorId: ex.moderatorId }));
  },
});

const typeName = (c: GuildChannel) => ChannelType[c.type] ?? String(c.type);

export const channelCreate = defineEvent({
  name: Events.ChannelCreate,
  async execute(client, channel) {
    const s = client.services;
    if (!(await s.logging.isConfigured(channel.guild.id, 'channelChange'))) return;
    const ex = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await s.logging.send(channel.guild, 'channelChange', channelLog({ kind: 'created', channelId: channel.id, name: channel.name, type: typeName(channel), changes: [], moderatorId: ex.moderatorId }));
  },
});

export const channelDelete = defineEvent({
  name: Events.ChannelDelete,
  async execute(client, channel) {
    if (channel.isDMBased()) return;
    const s = client.services;
    if (!(await s.logging.isConfigured(channel.guild.id, 'channelChange'))) return;
    const ex = await findExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await s.logging.send(channel.guild, 'channelChange', channelLog({ kind: 'deleted', channelId: channel.id, name: channel.name, type: typeName(channel), changes: [], moderatorId: ex.moderatorId }));
  },
});

export const channelUpdate = defineEvent({
  name: Events.ChannelUpdate,
  async execute(client, oldCh, newCh) {
    if (oldCh.isDMBased() || newCh.isDMBased()) return;
    const o = oldCh as GuildChannel & { topic?: string | null; nsfw?: boolean; rateLimitPerUser?: number };
    const n = newCh as GuildChannel & { topic?: string | null; nsfw?: boolean; rateLimitPerUser?: number };
    const changes: string[] = [];
    if (o.name !== n.name) changes.push(`Name: ${o.name} → ${n.name}`);
    if ((o.topic ?? null) !== (n.topic ?? null)) changes.push('Topic changed');
    if ((o.nsfw ?? false) !== (n.nsfw ?? false)) changes.push(`NSFW: ${o.nsfw ?? false} → ${n.nsfw ?? false}`);
    if ((o.rateLimitPerUser ?? 0) !== (n.rateLimitPerUser ?? 0)) changes.push(`Slowmode: ${o.rateLimitPerUser ?? 0}s → ${n.rateLimitPerUser ?? 0}s`);
    if (o.parentId !== n.parentId) changes.push(`Category: ${o.parentId ? `<#${o.parentId}>` : 'none'} → ${n.parentId ? `<#${n.parentId}>` : 'none'}`);
    const sig = (c: GuildChannel) => [...c.permissionOverwrites.cache.values()].map((p) => `${p.id}:${p.allow.bitfield}:${p.deny.bitfield}`).sort().join('|');
    if (sig(o) !== sig(n)) changes.push('Permission overwrites changed');
    if (!changes.length) return;
    const s = client.services;
    if (!(await s.logging.isConfigured(n.guild.id, 'channelChange'))) return;
    const ex = await findExecutor(n.guild, AuditLogEvent.ChannelUpdate, n.id);
    await s.logging.send(n.guild, 'channelChange', channelLog({ kind: 'updated', channelId: n.id, name: n.name, type: typeName(n), changes, moderatorId: ex.moderatorId }));
  },
});
