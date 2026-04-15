import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __cateros_pg__: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;

const client =
  globalThis.__cateros_pg__ ??
  (connectionString ? postgres(connectionString, { prepare: false, max: 10 }) : undefined);

if (process.env.NODE_ENV !== 'production' && client) {
  globalThis.__cateros_pg__ = client;
}

export const db = client ? drizzle(client, { schema }) : null;
export { schema };
export * from './schema';
