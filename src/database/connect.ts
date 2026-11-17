import mongoose from 'mongoose';
import { childLogger } from '../utils/logger.js';
import { redactSecrets } from '../utils/redact.js';
import { ALL_MODELS } from './models/index.js';

const log = childLogger('database');

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected (driver will retry)'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => log.error({ err: redactSecrets(String(err?.message ?? err)) }, 'MongoDB error'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000, maxPoolSize: 20, retryWrites: true, appName: 'ziuux' });
  } catch (err) {
    throw new Error(`MongoDB connection failed: ${redactSecrets(err instanceof Error ? err.message : String(err))}`);
  }
  // Build indexes explicitly (unique / TTL) before serving traffic.
  await Promise.all(ALL_MODELS.map((m) => m.init()));
  log.info('MongoDB connected and indexes ensured');
}

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
