import { card } from '@/lib/mcp';
import { json, event, failure } from '@/lib/commons';
export async function GET(r: Request) {
  try {
    await event(r, 'server_card_read');
    return json(card());
  } catch (e) {
    return failure(e);
  }
}
