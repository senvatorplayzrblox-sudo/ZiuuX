export function truncate(text: string, max: number, ellipsis = '…'): string {
  if (max <= 0) return '';
  return text.length <= max ? text : text.slice(0, Math.max(0, max - ellipsis.length)) + ellipsis;
}

/** Neutralise markdown / mentions so user content can't break embeds or ping people. */
export function sanitizeInline(text: string): string {
  return text
    .replace(/[\\`*_~|>]/g, (c) => `\\${c}`)
    .replace(/@(everyone|here)/g, '@\u200b$1')
    .replace(/<@/g, '<\u200b@');
}

export function codeBlockSafe(text: string): string {
  return text.replace(/```/g, '`\u200b``');
}

export function cleanReason(reason: string | null | undefined, max = 512): string | null {
  const r = (reason ?? '').replace(/\s+/g, ' ').trim();
  return r ? truncate(r, max) : null;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
