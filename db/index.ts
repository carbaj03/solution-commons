import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Check the DB binding in wrangler.jsonc.',
    );
  }

  return drizzle(env.DB, { schema });
}

export function database() {
  return env.DB;
}
export function operatorToken() {
  return (env as unknown as Record<string, string>).OPERATOR_TOKEN || '';
}
