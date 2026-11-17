import { GuildSettingsRepo } from '../database/repositories/index.js';
import { TtlCache } from '../utils/cache.js';

export class GuildSettingsService {
  private readonly ensured = new TtlCache<true>(10 * 60_000, 20_000);

  /** Idempotent provisioning of the per-guild settings document. */
  async ensure(guildId: string): Promise<void> {
    if (this.ensured.get(guildId)) return;
    await GuildSettingsRepo.ensure(guildId);
    this.ensured.set(guildId, true);
  }

  async onGuildJoin(guildId: string): Promise<void> {
    this.ensured.delete(guildId);
    await this.ensure(guildId);
  }

  async onGuildLeave(guildId: string): Promise<void> {
    this.ensured.delete(guildId);
    await GuildSettingsRepo.markInactive(guildId);
  }
}
