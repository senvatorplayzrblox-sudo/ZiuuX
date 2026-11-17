const secrets = new Set<string>();

/** Register values (API keys, tokens) that must be scrubbed from any logged text. */
export function registerSecrets(values: string[]): void {
  for (const v of values) if (v && v.length >= 8) secrets.add(v);
}

export function redactSecrets(text: string): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join('[redacted]');
  // Generic patterns as a second line of defence.
  out = out.replace(/(key|token|authorization)=([^&\s]+)/gi, '$1=[redacted]');
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
  return out;
}
