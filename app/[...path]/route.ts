import { card } from '@/lib/mcp';
import { event, json, failure } from '@/lib/commons';
export async function GET(
  r: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.join('/') !== '.well-known/mcp/server-card.json')
    return json({ error: 'Not found' }, 404);
  try {
    await event(r, 'server_card_read');
    return json(card());
  } catch (e) {
    return failure(e);
  }
}
