import { pino, type Logger } from 'pino';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { app: 'ziuux' },
  redact: { paths: ['token', 'apiKey', '*.token', '*.apiKey', 'headers.authorization'], censor: '[redacted]' },
});

export function childLogger(module: string): Logger {
  return logger.child({ module });
}
