/**
 * The ONLY place custom emojis are defined. 40 emojis, exact IDs as supplied.
 * Never hard-code emoji strings elsewhere; use e() / withEmoji() / componentEmoji().
 */
export interface EmojiDef {
  readonly id: string;
  readonly name: string;
  readonly animated?: boolean;
}

export const EMOJI_DEFS = {
  ai: { id: '1571106585047207966', name: 'ss_ai' },
  aiDetect: { id: '1571107765483475025', name: 'ss_ai_detect' },
  appeal: { id: '1571108056870428772', name: 'ss_appeal' },
  back: { id: '1571107312922267739', name: 'ss_back' },
  ban: { id: '1571107987735449720', name: 'ss_ban' },
  bot: { id: '1571107405411000360', name: 'ss_bot' },
  channel: { id: '1571107597317181624', name: 'ss_channel' },
  command: { id: '1571107617315491982', name: 'ss_command' },
  delete: { id: '1571108294872010763', name: 'ss_delete' },
  disabled: { id: '1571107268961898506', name: 'ss_disabled' },
  edit: { id: '1571107010374537226', name: 'ss_edit' },
  enabled: { id: '1571107262938878022', name: 'ss_enabled' },
  error: { id: '1571107080641847337', name: 'ss_error' },
  history: { id: '1571108274575642765', name: 'ss_history' },
  home: { id: '1571107370803789896', name: 'ss_home' },
  info: { id: '1571107196547375154', name: 'ss_info' },
  join: { id: '1571108132241801277', name: 'ss_join' },
  kick: { id: '1571108046271152148', name: 'ss_kick' },
  leave: { id: '1571108161409253406', name: 'ss_leave' },
  lock: { id: '1571107639696298004', name: 'ss_lock' },
  logo: { id: '1571106376019615795', name: 'ss_logo' },
  logs: { id: '1571108078387069019', name: 'ss_logs' },
  message: { id: '1571108079733571604', name: 'ss_message' },
  mute: { id: '1571107962741596180', name: 'ss_mute' },
  refresh: { id: '1571107290155589712', name: 'ss_refresh' },
  reset: { id: '1571108320637485136', name: 'ss_reset' },
  role: { id: '1571107470158471198', name: 'ss_role' },
  save: { id: '1571108310495531068', name: 'ss_save' },
  settings: { id: '1571106977440989234', name: 'ss_settings' },
  shield: { id: '1571106837422411776', name: 'ss_shield' },
  staff: { id: '1571107440592683089', name: 'ss_staff' },
  stats: { id: '1571108239364456458', name: 'ss_stats' },
  success: { id: '1571107049847259276', name: 'ss_success' },
  ticket: { id: '1571109756523913257', name: 'ss_ticket' },
  // The supplied emoji is literally named "ss_unclock"; the ID/name are kept exactly, the semantic key is "unlock".
  unlock: { id: '1571107678464245760', name: 'ss_unclock' },
  user: { id: '1571107408821096589', name: 'ss_user' },
  voice: { id: '1571108201104150608', name: 'ss_voice' },
  warn: { id: '1571107940918624336', name: 'ss_warn' },
  warning: { id: '1571107162590281738', name: 'ss_warning' },
  words: { id: '1571107806021558394', name: 'ss_words' },
} as const satisfies Record<string, EmojiDef>;

export type EmojiKey = keyof typeof EMOJI_DEFS;
export const EMOJI_KEYS = Object.keys(EMOJI_DEFS) as EmojiKey[];

/** Emojis found to be unavailable to the bot (set on ready). Unknown until checked => treated as available. */
const unavailable = new Set<EmojiKey>();

export function updateEmojiAvailability(hasEmoji: (id: string) => boolean): EmojiKey[] {
  unavailable.clear();
  for (const key of EMOJI_KEYS) if (!hasEmoji(EMOJI_DEFS[key].id)) unavailable.add(key);
  return [...unavailable];
}

export function isEmojiAvailable(key: EmojiKey): boolean {
  return !unavailable.has(key);
}

/** Inline markup for messages/embeds. Empty string if the emoji is unavailable. Never substitutes Unicode. */
export function e(key: EmojiKey): string {
  if (unavailable.has(key)) return '';
  const d: EmojiDef = EMOJI_DEFS[key];
  return `<${d.animated ? 'a' : ''}:${d.name}:${d.id}>`;
}

/** "<emoji> text" - degrades to just the text when the emoji is unavailable. */
export function withEmoji(key: EmojiKey, text: string): string {
  const m = e(key);
  return m ? `${m} ${text}` : text;
}

/** Emoji object for buttons/selects, or undefined if unavailable. */
export function componentEmoji(key: EmojiKey): { id: string; name: string; animated: boolean } | undefined {
  if (unavailable.has(key)) return undefined;
  const d: EmojiDef = EMOJI_DEFS[key];
  return { id: d.id, name: d.name, animated: d.animated === true };
}
