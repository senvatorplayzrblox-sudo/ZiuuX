import { createHash } from 'node:crypto';
import type { Command } from '../../types/command.js';
import { COMMAND_KEYS } from '../../config/commandKeys.js';

export function buildRegistry(commands: Command[]): Map<string, Command> {
  const map = new Map<string, Command>();
  const keys = new Set<string>();
  for (const c of commands) {
    if (map.has(c.data.name)) throw new Error(`Duplicate command name: ${c.data.name}`);
    if (keys.has(c.key)) throw new Error(`Duplicate command key: ${c.key}`);
    if (c.data.name !== c.key) throw new Error(`Command "${c.data.name}" must use the same string as its commandKey ("${c.key}")`);
    keys.add(c.key);
    map.set(c.data.name, c);
  }
  const missing = COMMAND_KEYS.filter((k) => !keys.has(k));
  if (missing.length) throw new Error(`Command keys without an implementation: ${missing.join(', ')}`);
  return map;
}

export function commandPayload(commands: Command[]) {
  return commands.map((c) => c.data.toJSON());
}

export function commandHash(commands: Command[], scope: string): string {
  return createHash('sha256').update(scope).update(JSON.stringify(commandPayload(commands))).digest('hex');
}
