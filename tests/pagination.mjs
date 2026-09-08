import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3017';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'Local fixture test must never run on production',
);
const tokens = Array.from({ length: 3 }, () => randomBytes(32).toString('hex'));
const tag = 'paging-' + randomBytes(4).toString('hex');
async function req(path, data) {
  const r = await fetch(origin + path, {
    headers: { 'content-type': 'application/json' },
    ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}),
  });
  const body = await r.json();
  assert.ok(r.ok, JSON.stringify(body));
  return body;
}
const ids = [];
for (let i = 0; i < 21; i++) {
  const row = await req('/api/solutions', {
    participant_token: tokens[i < 20 ? 0 : 1],
    public: true,
    idempotency_key: randomUUID(),
    title: 'Local pagination fixture ' + i,
    problem:
      'Local fixture verifies that filtered search pages do not lose records.',
    context: 'Local database only',
    solution:
      'Keep a stable timestamp and ID cursor with the original search filters.',
    verification: 'Synthetic pagination check',
    verification_state: 'not-tested',
    limitations: 'Local-only fixture, no adoption evidence',
    tags: [tag],
  });
  ids.push(row.solution_id);
}
const p1 = await req('/api/solutions?view=untested&tag=' + tag);
assert.equal(p1.solutions.length, 20);
assert.ok(p1.next_cursor);
const p2 = await req(
  '/api/solutions?' +
    new URLSearchParams({ view: 'untested', tag, before: p1.next_cursor }),
);
assert.equal(p2.solutions.length, 1);
assert.equal(p2.next_cursor, null);
assert.deepEqual(
  new Set([...p1.solutions, ...p2.solutions].map((s) => s.id)),
  new Set(ids),
);
assert.equal(
  (await req('/api/solutions?' + new URLSearchParams({ tag, q: '%' })))
    .solutions.length,
  0,
);
const reports = [];
for (let i = 0; i < 51; i++) {
  const r = await req('/api/reuse', {
    participant_token: tokens[i < 26 ? 1 : 2],
    public: true,
    idempotency_key: randomUUID(),
    solution_id: ids[0],
    outcome: 'partly',
    details:
      'Local pagination fixture ' +
      i +
      '; this is not an actual production reuse.',
  });
  reports.push(r.report_id);
}
const f1 = await req('/api/feedback', { participant_token: tokens[0] });
assert.equal(f1.feedback.length, 50);
assert.equal(f1.has_more, true);
const f2 = await req('/api/feedback', {
  participant_token: tokens[0],
  after: f1.next_cursor,
});
assert.equal(f2.feedback.length, 1);
assert.equal(f2.has_more, false);
assert.deepEqual(
  new Set([...f1.feedback, ...f2.feedback].map((f) => f.id)),
  new Set(reports),
);
const f3 = await req('/api/feedback', {
  participant_token: tokens[0],
  after: f2.next_cursor,
});
assert.equal(f3.feedback.length, 0);
assert.equal(f3.next_cursor, f2.next_cursor);
console.log(
  JSON.stringify({
    status: 'passed',
    origin,
    checks: [
      '21 filtered solutions across two pages without duplicates',
      'Literal percent query does not act as a wildcard',
      '51 peer reports across inbox pages without loss or repeats',
      'Empty inbox preserves incremental cursor',
    ],
  }),
);
