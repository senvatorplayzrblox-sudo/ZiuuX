import { MessageFlags, type ChatInputCommandInteraction, type MessageComponentInteraction, type ModalSubmitInteraction, type EmbedBuilder } from 'discord.js';
import type { View } from '../ui/components/builders.js';

export type AnyRepliable = ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction;

/**
 * discord.js overloads reply/editReply differently per interaction class, which makes calls on a UNION of the
 * classes un-callable for TypeScript. Every interaction type supports exactly these methods, so we call them
 * through this narrow structural view instead (behaviour is unchanged).
 */
interface Repliable {
  deferred: boolean;
  replied: boolean;
  deferReply(options: { flags: MessageFlags.Ephemeral }): Promise<unknown>;
  deferUpdate(): Promise<unknown>;
  reply(options: unknown): Promise<unknown>;
  editReply(options: unknown): Promise<unknown>;
  followUp(options: unknown): Promise<unknown>;
}
const R = (i: AnyRepliable): Repliable => i as unknown as Repliable;

/** How each interaction was acknowledged, so errors/notices go to the right place. */
const modes = new WeakMap<object, 'reply' | 'update'>();

/** Ephemeral "thinking" ack; the result later replaces it (editReply). */
export async function deferEphemeral(i: AnyRepliable): Promise<void> {
  await R(i).deferReply({ flags: MessageFlags.Ephemeral });
  modes.set(i, 'reply');
}

/** Acknowledge a panel interaction so the panel message itself can be re-rendered with editReply. */
export async function deferPanel(i: MessageComponentInteraction | ModalSubmitInteraction): Promise<void> {
  if (i.isModalSubmit() && !i.isFromMessage()) {
    await R(i).deferReply({ flags: MessageFlags.Ephemeral });
    modes.set(i, 'reply');
    return;
  }
  await R(i).deferUpdate();
  modes.set(i, 'update');
}

/** Re-render the panel (after deferPanel) or fill the deferred reply (after deferEphemeral). */
export async function editView(i: AnyRepliable, view: View): Promise<void> {
  await R(i).editReply({ embeds: view.embeds, components: view.components });
}

/** Send a message to the user without touching the panel. Always ephemeral. */
export async function notify(i: AnyRepliable, embed: EmbedBuilder, components: View['components'] = []): Promise<void> {
  const payload = { embeds: [embed], components };
  const r = R(i);
  if (!r.deferred && !r.replied) {
    await r.reply({ ...payload, flags: MessageFlags.Ephemeral });
    return;
  }
  if (modes.get(i) === 'reply' && !r.replied) await r.editReply(payload);
  else await r.followUp({ ...payload, flags: MessageFlags.Ephemeral });
}

/** Reply with a full view when not yet acknowledged, otherwise edit. (Ephemeral.) */
export async function showView(i: AnyRepliable, view: View): Promise<void> {
  const r = R(i);
  if (!r.deferred && !r.replied) await r.reply({ embeds: view.embeds, components: view.components, flags: MessageFlags.Ephemeral });
  else await r.editReply({ embeds: view.embeds, components: view.components });
}
