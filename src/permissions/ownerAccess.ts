/**
 * PURE owner-bypass rule for ZiuuX CONFIG PANELS ONLY. This file knows nothing about moderation.
 * The owner's ID is injected by OwnerGate (the only module allowed to read the owner setting).
 */
export interface ConfigAccessInput {
  userId: string;
  ownerId: string;
  /** Result of the normal Discord-permission check for this panel. */
  discordAllowed: boolean;
}

export function resolveConfigAccess(i: ConfigAccessInput): { allowed: boolean; viaOwnerBypass: boolean } {
  if (i.discordAllowed) return { allowed: true, viaOwnerBypass: false };
  if (i.userId === i.ownerId) return { allowed: true, viaOwnerBypass: true };
  return { allowed: false, viaOwnerBypass: false };
}
