import { Events, type Message, type PartialMessage } from 'discord.js';
import { defineEvent } from '../../types/event.js';
import { bulkDeleteLog, messageDeleteLog, messageEditLog } from '../../ui/embeds/log.js';

export const messageCreate = defineEvent({
  name: Events.MessageCreate,
  async execute(client, message) {
    await client.services.aiModeration.handleMessage(message);
  },
});

export const messageUpdate = defineEvent({
  name: Events.MessageUpdate,
  async execute(client, oldMessage, newMessage) {
    const msg: Message | PartialMessage | null = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
    if (!msg || !msg.inGuild() || msg.author?.bot) return;
    if (oldMessage.content === msg.content) return; // embed/pin updates etc.

    const s = client.services;
    if (msg.content && !msg.partial) void s.aiModeration.handleMessage(msg as Message); // edits are scanned like new messages
    await s.logging.send(msg.guild, 'messageEdit', messageEditLog({ authorId: msg.author?.id ?? null, channelId: msg.channelId, messageId: msg.id, url: msg.url, before: oldMessage.content ?? null, after: msg.content ?? null }));
  },
});

export const messageDelete = defineEvent({
  name: Events.MessageDelete,
  async execute(client, message) {
    if (!message.inGuild() || message.author?.id === client.user?.id) return;
    const s = client.services;
    const marker = s.markers.peek(message.guildId, 'aiDelete', message.id);
    await s.logging.send(message.guild, 'messageDelete', messageDeleteLog({
      authorId: message.author?.id ?? null, channelId: message.channelId, messageId: message.id, content: message.content ?? null, attachments: message.attachments?.size ?? 0,
      note: marker ? 'Removed by ZiuuX AI moderation.' : null,
    }));
  },
});

export const messageDeleteBulk = defineEvent({
  name: Events.MessageBulkDelete,
  async execute(client, messages, channel) {
    const s = client.services;
    const marker = s.markers.peek(channel.guild.id, 'purge', channel.id);
    await s.logging.send(channel.guild, 'messageDelete', bulkDeleteLog({ channelId: channel.id, count: messages.size, note: marker ? `Purged by <@${marker.moderatorId}> via ZiuuX.` : null }));
  },
});
