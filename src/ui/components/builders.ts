import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle,
  ModalBuilder, type MessageActionRowComponentBuilder, type EmbedBuilder,
} from 'discord.js';
import { componentEmoji, type EmojiKey } from '../../config/emojis.js';
import { truncate } from '../../utils/text.js';

export type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;
export interface View {
  embeds: EmbedBuilder[];
  components: Row[];
}

export function row(...components: MessageActionRowComponentBuilder[]): Row {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

export function button(customId: string, label: string, style: ButtonStyle = ButtonStyle.Secondary, emoji?: EmojiKey, disabled = false): ButtonBuilder {
  const b = new ButtonBuilder().setCustomId(customId).setLabel(truncate(label, 80)).setStyle(style).setDisabled(disabled);
  const em = emoji ? componentEmoji(emoji) : undefined;
  if (em) b.setEmoji(em);
  return b;
}

export interface SelectOption { label: string; value: string; description?: string; emoji?: EmojiKey; default?: boolean }

export function stringSelect(customId: string, placeholder: string, options: SelectOption[], opts: { min?: number; max?: number; disabled?: boolean } = {}): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(truncate(placeholder, 150)).setDisabled(opts.disabled ?? false);
  const list = options.slice(0, 25);
  menu.addOptions(
    list.map((o) => {
      const b = new StringSelectMenuOptionBuilder().setLabel(truncate(o.label, 100)).setValue(o.value).setDefault(o.default ?? false);
      if (o.description) b.setDescription(truncate(o.description, 100));
      const em = o.emoji ? componentEmoji(o.emoji) : undefined;
      if (em) b.setEmoji(em);
      return b;
    }),
  );
  menu.setMinValues(opts.min ?? 1).setMaxValues(Math.min(opts.max ?? 1, list.length));
  return menu;
}

export interface ModalField { id: string; label: string; style?: 'short' | 'paragraph'; required?: boolean; placeholder?: string; min?: number; max?: number; value?: string }

export function modal(customId: string, title: string, fields: ModalField[]): ModalBuilder {
  const m = new ModalBuilder().setCustomId(customId).setTitle(truncate(title, 45));
  for (const f of fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(truncate(f.label, 45))
      .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(f.required ?? false);
    if (f.placeholder) input.setPlaceholder(truncate(f.placeholder, 100));
    if (f.min !== undefined) input.setMinLength(f.min);
    if (f.max !== undefined) input.setMaxLength(f.max);
    if (f.value) input.setValue(truncate(f.value, f.max ?? 4000));
    m.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  return m;
}
