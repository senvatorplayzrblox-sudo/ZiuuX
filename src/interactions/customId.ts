import { z } from 'zod';
import { LIMITS } from '../config/constants.js';

export const MODULES = ['sp', 'am', 'cc', 'bs'] as const; // staffpanel, aimod, cmdconfig, botsettings
export type ModuleId = (typeof MODULES)[number];

const PREFIX = 'zx';
const TOKEN = /^[A-Za-z0-9_.-]+$/;

const parsedSchema = z.object({
  module: z.enum(MODULES),
  action: z.string().regex(TOKEN).max(32),
  args: z.array(z.string().regex(TOKEN).max(40)).max(6),
});
export type ParsedCustomId = z.infer<typeof parsedSchema>;

/** Custom IDs carry identifiers only; authorisation is re-evaluated on every interaction. */
export function buildCustomId(module: ModuleId, action: string, ...args: Array<string | number>): string {
  const parts = [PREFIX, module, action, ...args.map(String)];
  for (const p of parts) if (!TOKEN.test(p)) throw new Error(`Invalid custom id segment: "${p}"`);
  const id = parts.join(':');
  if (id.length > LIMITS.customIdMax) throw new Error(`Custom id too long (${id.length}): ${id}`);
  return id;
}

export function parseCustomId(id: string): ParsedCustomId | null {
  if (id.length > LIMITS.customIdMax) return null;
  const [prefix, module, action, ...args] = id.split(':');
  if (prefix !== PREFIX) return null;
  const r = parsedSchema.safeParse({ module, action, args });
  return r.success ? r.data : null;
}
