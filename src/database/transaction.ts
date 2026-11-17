import mongoose, { type ClientSession } from 'mongoose';

/** Runs fn in a MongoDB transaction (requires a replica set: Atlas always is). Retries transient errors. */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  return (await mongoose.connection.transaction(fn)) as T;
}
