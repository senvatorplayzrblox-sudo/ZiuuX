const SNOWFLAKE = /^\d{17,20}$/;

export function isSnowflake(v: unknown): v is string {
  return typeof v === 'string' && SNOWFLAKE.test(v);
}

/** Accepts a raw ID, <@id>, <@!id>, <#id> or <@&id>. Returns null when invalid. */
export function parseSnowflake(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.trim().match(/^(?:<[@#][!&]?)?(\d{17,20})>?$/);
  return m?.[1] ?? null;
}
