import type { Server } from 'node:http';
import type { ZiuuXClient } from '../client/ZiuuXClient.js';
import { disconnectDatabase } from '../database/connect.js';
import { logger } from '../utils/logger.js';
import { redactSecrets } from '../utils/redact.js';

export function installProcessHandlers(client: ZiuuXClient, server: Server): void {
  let closing = false;
  const shutdown = async (signal: string, code = 0) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(code || 1), 15_000);
    force.unref();
    try {
      const s = client.services;
      await s.aiModeration.shutdown(); // stop accepting AI work, let in-flight requests finish (bounded)
      s.retention.stop();
      await s.health.stop(); // flushes provider health
      await client.destroy();
      server.close();
      await disconnectDatabase();
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
    }
    process.exit(code);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: redactSecrets(reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason)) }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: redactSecrets(`${err.message}\n${err.stack}`) }, 'uncaught exception; exiting so the platform restarts a clean process');
    void shutdown('uncaughtException', 1);
  });
}
