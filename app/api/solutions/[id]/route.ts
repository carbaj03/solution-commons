import { read, event, json, failure } from '@/lib/commons';
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const d = await read((await params).id);
    await event(r, 'solution_read');
    return json(d);
  } catch (e) {
    return failure(e);
  }
}
