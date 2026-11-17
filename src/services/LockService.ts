import { PermissionFlagsBits, type NewsChannel, type TextChannel } from 'discord.js';
import { ChannelLockRepo } from '../database/repositories/index.js';
import { BotError } from '../core/errors/BotError.js';
import type { ChannelLockDoc } from '../database/models/index.js';

export type LockableChannel = TextChannel | NewsChannel;
type Tri = boolean | null;

/**
 * Locks by denying SendMessages for @everyone while remembering the PREVIOUS overwrite state, so /unlock
 * restores exactly what was there (allow / deny / inherit) instead of blindly resetting it.
 * Note: roles with their own explicit allow overwrite (e.g. staff) can still speak, as in Discord generally.
 */
export class LockService {
  private tri(channel: LockableChannel, flag: 'SendMessages' | 'SendMessagesInThreads'): Tri {
    const ow = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
    if (!ow) return null;
    if (ow.allow.has(PermissionFlagsBits[flag])) return true;
    if (ow.deny.has(PermissionFlagsBits[flag])) return false;
    return null;
  }

  async isLocked(guildId: string, channelId: string): Promise<boolean> {
    return (await ChannelLockRepo.find(guildId, channelId)) !== null;
  }

  async lock(channel: LockableChannel, by: string, reason: string): Promise<void> {
    if (await ChannelLockRepo.find(channel.guild.id, channel.id)) throw new BotError('already_done', 'This channel is already locked by ZiuuX.');
    const previous = { sendMessages: this.tri(channel, 'SendMessages'), sendMessagesInThreads: this.tri(channel, 'SendMessagesInThreads') };
    if (previous.sendMessages === false) throw new BotError('already_done', 'Members already cannot send messages in this channel.');
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false, SendMessagesInThreads: false }, { reason });
    await ChannelLockRepo.upsert(channel.guild.id, { channelId: channel.id, previous, lockedBy: by, caseNumber: null });
  }

  /** Returns a note when no saved state existed. */
  async unlock(channel: LockableChannel, reason: string): Promise<{ note: string | null }> {
    const record: ChannelLockDoc | null = await ChannelLockRepo.find(channel.guild.id, channel.id);
    let prev: { sendMessages: Tri; sendMessagesInThreads: Tri };
    let note: string | null = null;
    if (record) prev = record.previous;
    else if (this.tri(channel, 'SendMessages') === false) {
      prev = { sendMessages: null, sendMessagesInThreads: null };
      note = 'This channel was not locked by ZiuuX, so the @everyone overwrite was reset to inherit.';
    } else throw new BotError('already_done', 'This channel is not locked.');
    await channel.permissionOverwrites.edit(
      channel.guild.roles.everyone,
      { SendMessages: prev.sendMessages, SendMessagesInThreads: prev.sendMessagesInThreads },
      { reason },
    );
    await ChannelLockRepo.delete(channel.guild.id, channel.id);
    return { note };
  }
}
