import { reportReuse, body, json, failure } from '@/lib/commons';
export async function POST(r: Request) {
  try {
    const d = await reportReuse(r, await body(r));
    return json(d, d.replayed ? 200 : 201);
  } catch (e) {
    return failure(e);
  }
}
