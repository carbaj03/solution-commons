import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3017',
  production = !new URL(origin).hostname.match(/^(localhost|127\.0\.0\.1)$/),
  key = (await readFile('.dev.vars', 'utf8')).match(/OPERATOR_TOKEN=(.*)/)[1];
const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'x-solution-commons-operator': key,
    'user-agent': 'SolutionCommonsOperatorValidation/1.0',
  },
  checks = [];
async function request(path, body, status = 200, h = headers) {
  const r = await fetch(origin + path, {
    headers: h,
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const text = await r.text();
  assert.equal(r.status, status, text.slice(0, 300));
  return JSON.parse(text);
}
async function mcp(name, args) {
  const r = await fetch(origin + '/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: name,
      params: args,
    }),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(r.status, 200);
  const text = await r.text();
  return JSON.parse(
    text.split('\n').some((l) => l.startsWith('data:'))
      ? text
          .split('\n')
          .find((l) => l.startsWith('data:'))
          .slice(5)
      : text,
  );
}
const pass = (n) => {
  checks.push(n);
  console.log('PASS ' + n);
};
const card = await request('/.well-known/mcp/server-card.json');
assert.equal(card.tools.length, 5);
const before = await request('/api/stats');
await request('/api/health');
const tools = await mcp('tools/list', {});
assert.equal(tools.result.tools.length, 5);
pass('Five MCP tools and database health');
const a = randomBytes(32).toString('hex'),
  b = randomBytes(32).toString('hex');
const payload = {
  participant_token: a,
  public: true,
  idempotency_key: randomUUID(),
  title: 'Operator fixture: deduplicate a repeated request',
  problem: 'A synthetic request is submitted twice after a lost response.',
  context: 'Isolated functional check; no customer data.',
  solution:
    'Store a unique request key and return the earlier result for an identical retry.',
  verification:
    'This check submits an identical publication twice and compares the IDs.',
  verification_state: 'observed',
  limitations: 'Operator fixture only; not evidence of agent discovery.',
  tags: ['operator-fixture'],
  human_directed: true,
  discovery: 'owner-directed',
};
await request('/api/solutions', { ...payload, public: false }, 400);
const published = await request('/api/solutions', payload, 201),
  replayed = await request('/api/solutions', payload);
assert.equal(published.solution_id, replayed.solution_id);
assert.equal(replayed.replayed, true);
assert.equal(published.cohort, 'operator');
assert.equal(published.url, null);
await request(
  '/api/solutions',
  { ...payload, title: 'Different content under the same key' },
  409,
);
pass('Publication consent, immutable retry and conflict handling');
const adapted = await mcp('tools/call', {
  name: 'solutions_publish',
  arguments: {
    ...payload,
    participant_token: b,
    idempotency_key: randomUUID(),
    based_on: published.solution_id,
    title: 'Operator fixture: adapt request deduplication',
  },
});
assert.ok(!adapted.result.isError, JSON.stringify(adapted));
const derived = JSON.parse(adapted.result.content[0].text);
assert.ok(derived.solution_id);
pass('MCP publication links an adaptation');
const reuse = {
  participant_token: b,
  public: true,
  idempotency_key: randomUUID(),
  solution_id: published.solution_id,
  outcome: 'worked',
  details:
    'Operator validation: repeated publication returned the same stored solution ID.',
};
const report = await request('/api/reuse', reuse, 201);
assert.equal(report.different_token, true);
assert.equal((await request('/api/reuse', reuse)).report_id, report.report_id);
await request('/api/reuse', { ...reuse, outcome: 'failed' }, 409);
pass('Cross-token reuse report, replay and conflict');
const inbox = await request('/api/feedback', { participant_token: a }, 200, {
  'content-type': 'application/json',
});
assert.equal(inbox.cohort, 'operator');
assert.deepEqual(
  new Set(inbox.feedback.map((f) => f.id)),
  new Set([derived.solution_id, report.report_id]),
);
assert.ok(inbox.feedback.every((f) => f.url === null));
assert.equal(
  (
    await request('/api/feedback', {
      participant_token: a,
      after: inbox.next_cursor,
    })
  ).feedback.length,
  0,
);
assert.equal(
  (await request('/api/feedback', { participant_token: b })).feedback.length,
  0,
);
await request('/api/feedback', { participant_token: '0'.repeat(64) }, 401);
await request('/api/feedback', { participant_token: a, after: 'bad' }, 400);
const mf = await mcp('tools/call', {
  name: 'solutions_check_feedback',
  arguments: { participant_token: a },
});
assert.ok(!mf.result.isError);
assert.equal(JSON.parse(mf.result.content[0].text).feedback.length, 2);
pass(
  'Private author inbox combines reuse and adaptations, preserves cohort, advances cursor, rejects unknown tokens',
);
await request('/api/solutions?view=bad', null, 400);

assert.equal(
  (await request('/api/solutions?q=operator-fixture')).solutions.some(
    (s) => s.id === published.solution_id,
  ),
  false,
);
await request('/api/solutions/' + published.solution_id, null, 404);
pass('Operator publications excluded from public search and records');
const search = await mcp('tools/call', {
  name: 'solutions_search',
  arguments: { q: 'operator-fixture' },
});
assert.ok(!search.result.isError);
const read = await mcp('tools/call', {
  name: 'solutions_read',
  arguments: { solution_id: published.solution_id },
});
assert.equal(read.result.isError, true);
const mr = await mcp('tools/call', {
  name: 'solutions_report_reuse',
  arguments: reuse,
});
assert.equal(JSON.parse(mr.result.content[0].text).report_id, report.report_id);
pass('All five MCP tool handlers exercised');
if (!production) {
  const h = { 'content-type': 'application/json' },
    token = randomBytes(32).toString('hex');
  const pub = await request(
    '/api/solutions',
    { ...payload, participant_token: token, idempotency_key: randomUUID() },
    201,
    h,
  );
  assert.ok(pub.url);
  const publicData = await request('/api/solutions/' + pub.solution_id);
  assert.equal(publicData.solution.problem, payload.problem);
  for (const k of [
    'actor',
    'participant_token',
    'cohort',
    'idem',
    'request_hash',
  ])
    assert.equal(k in publicData.solution, false);
  const adaptedPublic = await request(
    '/api/solutions',
    {
      ...payload,
      participant_token: token,
      idempotency_key: randomUUID(),
      based_on: pub.solution_id,
    },
    201,
    h,
  );
  await request(
    '/api/reuse',
    {
      ...reuse,
      participant_token: token,
      idempotency_key: randomUUID(),
      solution_id: pub.solution_id,
    },
    201,
    h,
  );
  const page = await request('/api/solutions/' + pub.solution_id);
  assert.ok(
    page.derived_solutions.some((s) => s.id === adaptedPublic.solution_id),
  );
  assert.equal(page.reuse_reports.length, 1);
  assert.equal(
    (await request('/api/feedback', { participant_token: token }, 200, h))
      .feedback.length,
    0,
    'Self-authored adaptations and reports are excluded',
  );
  assert.ok(
    !(await request('/api/solutions?view=untested')).solutions.some(
      (x) => x.id === pub.solution_id,
    ),
  );
  const uniqueTag = 'case-' + randomBytes(4).toString('hex');
  const untested = await request(
    '/api/solutions',
    {
      ...payload,
      participant_token: token,
      idempotency_key: randomUUID(),
      verification_state: 'not-tested',
      tags: [uniqueTag],
    },
    201,
    h,
  );
  assert.ok(
    (
      await request('/api/solutions?view=untested&tag=' + uniqueTag)
    ).solutions.some((x) => x.id === untested.solution_id),
  );
  assert.equal(
    (await request('/api/solutions?view=reported-problems&tag=' + uniqueTag))
      .solutions.length,
    0,
  );
  await request(
    '/api/reuse',
    {
      ...reuse,
      participant_token: token,
      idempotency_key: randomUUID(),
      solution_id: untested.solution_id,
      outcome: 'partly',
    },
    201,
    h,
  );
  const problemView = await request(
    '/api/solutions?view=reported-problems&tag=' + uniqueTag,
  );
  assert.equal(problemView.solutions[0].id, untested.solution_id);
  assert.equal(
    problemView.solutions[0].peer_report_count,
    0,
    'Self-report is not a peer report',
  );
  assert.equal(
    (
      await request(
        '/api/solutions?view=reported-problems&tag=' +
          uniqueTag +
          '&q=' +
          randomUUID(),
      )
    ).solutions.length,
    0,
  );
  pass(
    'Local evidence filters compose with search/tag and distinguish self-reports from peer reports',
  );
  pass(
    'Local public publication/read/reuse/adaptation loop and private-field exclusion',
  );
}
const after = await request('/api/stats');
const total = (d, name, c, key = 'count') =>
  d[name]
    .filter((r) => r.cohort === c)
    .reduce((n, r) => n + Number(r[key] || 0), 0);
assert.equal(
  total(after, 'solutions', 'operator') -
    total(before, 'solutions', 'operator'),
  2,
);
assert.equal(
  total(after, 'reuse_reports', 'operator') -
    total(before, 'reuse_reports', 'operator'),
  1,
);
pass('Stored cohort totals reconcile without double counting');
const result = {
  as_of: new Date().toISOString(),
  origin,
  production,
  cohort: 'operator',
  checks,
  operator_solution_id: published.solution_id,
  operator_derivative_id: derived.solution_id,
  limitations: [
    'Directed functional checks; no independent agent discovery.',
    'Local-only public fixtures never sent to production.',
  ],
};
if (process.env.TEST_RECORD)
  await writeFile(process.env.TEST_RECORD, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: 'passed', checks: checks.length }));
