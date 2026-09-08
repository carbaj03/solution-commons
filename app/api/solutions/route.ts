import { search, publish, event, body, json, failure } from '@/lib/commons';
export async function GET(r: Request) {
  try {
    const d = await search(Object.fromEntries(new URL(r.url).searchParams));
    await event(r, 'solution_search');
    await event(
      r,
      d.solutions.length ? 'solution_search_matched' : 'solution_search_empty',
    );
    return json(d);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    const d = await publish(r, await body(r));
    return json(d, d.replayed ? 200 : 201);
  } catch (e) {
    return failure(e);
  }
}
