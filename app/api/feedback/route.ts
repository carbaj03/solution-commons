import { checkFeedback, event, body, json, failure } from '@/lib/commons';
export async function POST(r: Request) {
  try {
    const data = await checkFeedback(await body(r));
    await event(r, 'feedback_inbox_read', data.cohort);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
