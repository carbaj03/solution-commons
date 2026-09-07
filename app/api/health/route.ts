import { database } from '@/db';
import { json, failure } from '@/lib/commons';
export async function GET() {
  try {
    await database().prepare('SELECT 1').first();
    return json({ status: 'ok', as_of: new Date().toISOString() });
  } catch (e) {
    return failure(e);
  }
}
