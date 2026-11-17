import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { StaffPanelConfigRepo } from '../database/repositories/index.js';
import { CACHE_TTL_MS, LIMITS } from '../config/constants.js';
import { TtlCache } from '../utils/cache.js';

export class StaffPanelService {
  private readonly cache = new TtlCache<string[]>(CACHE_TTL_MS, 5000);

  async getStaffRoleIds(guildId: string): Promise<string[]> {
    const hit = this.cache.get(guildId);
    if (hit) return hit;
    const ids = (await StaffPanelConfigRepo.get(guildId))?.staffRoleIds ?? [];
    this.cache.set(guildId, ids);
    return ids;
  }

  async setStaffRoleIds(guildId: string, ids: string[]): Promise<void> {
    await StaffPanelConfigRepo.setRoles(guildId, [...new Set(ids)].slice(0, LIMITS.staffRolesMax));
    this.cache.delete(guildId);
  }

  /** Discord-side access rule for opening the staff panel. Staff roles only open the panel; they NEVER grant action permissions. */
  async hasStaffAccess(member: GuildMember): Promise<boolean> {
    if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true; // Administrator implies every permission
    const roles = await this.getStaffRoleIds(member.guild.id);
    return roles.some((r) => member.roles.cache.has(r));
  }
}
