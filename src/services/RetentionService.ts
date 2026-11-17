import { GUILD_SCOPED_REPOS, GuildSettingsRepo } from '../database/repositories/index.js';
import { RETENTION } from '../config/constants.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('retention');

/** Deletes ALL data for guilds ZiuuX has been out of for 30+ days. (AI incidents / owner audit expire via TTL indexes.) */
export class RetentionService {
  private timer: NodeJS.Timeout | null = null;

  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION.guildPurgeDays * 86_400_000);
    const expired = await GuildSettingsRepo.findExpired(cutoff);
    for (const guildId of expired) {
      for (const repo of GUILD_SCOPED_REPOS) await repo.deleteGuildData(guildId);
      log.info({ guildId }, 'purged data for guild removed more than the retention period ago');
    }
    return expired.length;
  }

  start(): void {
    const run = () => this.sweep().catch((err) => log.error({ err }, 'retention sweep failed'));
    void run();
    this.timer = setInterval(run, 6 * 3600_000);
    this.timer.unref();
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
