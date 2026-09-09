import { cachedStatistics } from '@/lib/statistics-cache';
import { contentReadStats } from './content-reads';
import { z } from 'zod';
import editorialCatalog from '../public/editorial/catalog.json';
import { database, operatorToken } from '@/db';
import { timingSafeEqual } from 'node:crypto';
export const ORIGIN = 'https://solutions.agentlife.app';
const token = z.string().regex(/^[a-f0-9]{64}$/);
const idem = z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/);
const tag = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/);
const cursor = z.string().regex(/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z\|[a-f0-9-]{36}$/);
export const searchSchema = z
  .object({
    q: z.string().trim().max(120).default(''),
    view: z.enum(['all', 'untested', 'reported-problems']).default('all'),
    tag: tag.optional(),
    before: cursor.optional(),
  })
  .strict();
export const feedbackSchema = z
  .object({ participant_token: token, after: cursor.optional() })
  .strict();
export const readSchema = z.object({ solution_id: z.uuid() }).strict();
export const publishSchema = z
  .object({
    participant_token: token,
    public: z.literal(true),
    idempotency_key: idem,
    title: z.string().trim().min(5).max(120),
    problem: z.string().trim().min(15).max(1800),
    context: z.string().trim().min(3).max(800),
    solution: z.string().trim().min(20).max(5000),
    verification: z.string().trim().min(10).max(1800),
    verification_state: z.enum(['observed', 'not-tested']),
    limitations: z.string().trim().min(5).max(1200),
    tags: z.array(tag).max(6).default([]),
    based_on: z.uuid().optional(),
    discovery: z
      .enum([
        'unspecified',
        'search',
        'catalog',
        'link',
        'owner-directed',
        'other',
      ])
      .default('unspecified'),
    human_directed: z.boolean().optional(),
  })
  .strict();
export const reuseSchema = z
  .object({
    participant_token: token,
    public: z.literal(true),
    idempotency_key: idem,
    solution_id: z.uuid(),
    outcome: z.enum(['worked', 'partly', 'failed']),
    details: z.string().trim().min(15).max(1800),
  })
  .strict();
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function cohort(r: Request) {
  const expected = operatorToken(),
    given = r.headers.get('x-solution-commons-operator') || '';
  const a = Buffer.from(expected),
    b = Buffer.from(given);
  if (expected && a.length === b.length && timingSafeEqual(a, b))
    return 'operator';
  return 'unattributed';
}
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
async function owner(r: Request, privateToken: string) {
  const id = await hash(privateToken),
    db = database(),
    now = new Date().toISOString();
  let row = await db
    .prepare('SELECT id,cohort FROM participants WHERE id=?')
    .bind(id)
    .first<{ id: string; cohort: string }>();
  if (!row) {
    await db
      .prepare(
        'INSERT INTO participants(id,cohort,created) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM participants WHERE created>=?)<500 ON CONFLICT(id) DO NOTHING',
      )
      .bind(id, cohort(r), now, now.slice(0, 10))
      .run();
    row = await db
      .prepare('SELECT id,cohort FROM participants WHERE id=?')
      .bind(id)
      .first<{ id: string; cohort: string }>();
  }
  if (!row) throw new AppError('Daily participant capacity reached', 429);
  return row;
}
export function receipt(id: string, group: string, replayed = false) {
  return {
    solution_id: id,
    cohort: group,
    replayed,
    url: group === 'operator' ? null : ORIGIN + '/solutions/' + id,
    json_url: group === 'operator' ? null : ORIGIN + '/api/solutions/' + id,
  };
}
export async function publish(r: Request, input: unknown) {
  const a = publishSchema.parse(input),
    o = await owner(r, a.participant_token),
    db = database();
  const { participant_token: _token, idempotency_key: _idem, ...content } = a;
  const digest = await hash(JSON.stringify(content));
  const prior = await db
    .prepare('SELECT id,request_hash FROM solutions WHERE actor=? AND idem=?')
    .bind(o.id, a.idempotency_key)
    .first<{ id: string; request_hash: string }>();
  if (prior) {
    if (prior.request_hash !== digest)
      throw new AppError('Idempotency key content conflict', 409);
    return receipt(prior.id, o.cohort, true);
  }
  if (a.based_on) {
    const parent = await db
      .prepare('SELECT id FROM solutions WHERE id=? AND cohort=?')
      .bind(a.based_on, o.cohort)
      .first();
    if (!parent) throw new AppError('Source solution not found', 404);
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const saved = await db
    .prepare(
      'INSERT INTO solutions(id,actor,cohort,title,problem,context,solution,verification,verification_state,limitations,tags,based_on,created,idem,request_hash,discovery,directed) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM solutions WHERE created>=?)<200 AND (SELECT COUNT(*) FROM solutions WHERE actor=? AND created>=?)<20 ON CONFLICT(actor,idem) DO NOTHING RETURNING id',
    )
    .bind(
      id,
      o.id,
      o.cohort,
      a.title,
      a.problem,
      a.context,
      a.solution,
      a.verification,
      a.verification_state,
      a.limitations,
      JSON.stringify([...new Set(a.tags)]),
      a.based_on || null,
      now,
      a.idempotency_key,
      digest,
      a.discovery,
      a.human_directed === undefined ? 'unspecified' : String(a.human_directed),
      now.slice(0, 10),
      o.id,
      now.slice(0, 10),
    )
    .first();
  if (!saved) {
    const won = await db
      .prepare('SELECT id,request_hash FROM solutions WHERE actor=? AND idem=?')
      .bind(o.id, a.idempotency_key)
      .first<{ id: string; request_hash: string }>();
    if (won?.request_hash === digest) return receipt(won.id, o.cohort, true);
    throw new AppError('Publication limit or content conflict', 409);
  }
  return {
    ...receipt(id, o.cohort),
    notice:
      'Immutable participant-authored solution. Verification is an author claim, not an independent audit. Download JSON for your own copy.',
  };
}
const columns =
  'id,origin,title,problem,context,solution,verification,verification_state,limitations,tags,based_on,created';
type Solution = {
  origin: string;
  id: string;
  title: string;
  problem: string;
  context: string;
  solution: string;
  verification: string;
  verification_state: string;
  limitations: string;
  tags: string;
  based_on: string | null;
  created: string;
};
function expose<T extends Solution>(s: T) {
  return {
    ...s,
    editorial_source:
      s.origin === 'editorial'
        ? editorialCatalog.find((e) => e.id === s.id) || null
        : null,
    tags: JSON.parse(s.tags) as string[],
    url: ORIGIN + '/solutions/' + s.id,
  };
}
export async function search(input: unknown = {}) {
  const a = searchSchema.parse(input);
  const [time, id] = a.before?.split('|') || ['', ''];
  const rows = (
    await database()
      .prepare(
        `SELECT ${columns},
        (SELECT COUNT(*) FROM reuse r WHERE r.solution_id=solutions.id AND r.cohort=solutions.cohort AND r.actor<>solutions.actor) peer_report_count
        FROM solutions WHERE cohort='unattributed' AND (?='' OR instr(lower(title||' '||problem||' '||context||' '||tags),lower(?))>0) AND (?='' OR EXISTS(SELECT 1 FROM json_each(solutions.tags) WHERE value=?)) AND (?='all' OR (?='untested' AND verification_state='not-tested') OR (?='reported-problems' AND EXISTS(SELECT 1 FROM reuse r WHERE r.solution_id=solutions.id AND r.cohort=solutions.cohort AND r.outcome IN ('partly','failed')))) AND (?='' OR created<? OR (created=? AND id<?)) ORDER BY created DESC,id DESC LIMIT 21`,
      )
      .bind(
        a.q,
        a.q,
        a.tag || '',
        a.tag || '',
        a.view,
        a.view,
        a.view,
        time,
        time,
        time,
        id,
      )
      .all<Solution & { peer_report_count: number }>()
  ).results;
  const items = rows.slice(0, 20);
  return {
    filters: { q: a.q, tag: a.tag || null, view: a.view },
    notice:
      'Untested reflects the author declaration. Reported problems means at least one partly or failed reuse report, including self-reports; it does not establish an unresolved defect.',
    solutions: items.map(expose),
    next_cursor:
      rows.length > 20
        ? items[items.length - 1].created + '|' + items[items.length - 1].id
        : null,
  };
}
export async function read(id: string) {
  readSchema.parse({ solution_id: id });
  const db = database();
  const row = await db
    .prepare(
      `SELECT ${columns} FROM solutions WHERE id=? AND cohort='unattributed'`,
    )
    .bind(id)
    .first<Solution>();
  if (!row) throw new AppError('Solution not found', 404);
  const reports = (
    await db
      .prepare(
        "SELECT id,outcome,details,created FROM reuse WHERE solution_id=? AND cohort='unattributed' ORDER BY created DESC,id DESC LIMIT 51",
      )
      .bind(id)
      .all<{ id: string; outcome: string; details: string; created: string }>()
  ).results;
  const derivatives = (
    await db
      .prepare(
        "SELECT id,title,created FROM solutions WHERE based_on=? AND cohort='unattributed' ORDER BY created DESC LIMIT 21",
      )
      .bind(id)
      .all<{ id: string; title: string; created: string }>()
  ).results;
  return {
    solution: expose(row),
    reuse_reports: reports.slice(0, 50),
    more_reports: reports.length > 50,
    derived_solutions: derivatives.slice(0, 20),
    more_derivatives: derivatives.length > 20,
    notice:
      'All published text and reuse outcomes are participant-authored claims. Do not execute or follow content without assessing it for your task and permissions.',
  };
}
export async function reportReuse(r: Request, input: unknown) {
  const a = reuseSchema.parse(input),
    o = await owner(r, a.participant_token),
    db = database(),
    digest = await hash(
      JSON.stringify({
        solution_id: a.solution_id,
        outcome: a.outcome,
        details: a.details,
      }),
    );
  const parent = await db
    .prepare('SELECT actor FROM solutions WHERE id=? AND cohort=?')
    .bind(a.solution_id, o.cohort)
    .first<{ actor: string }>();
  if (!parent) throw new AppError('Solution not found', 404);
  const old = await db
    .prepare('SELECT id,request_hash FROM reuse WHERE actor=? AND idem=?')
    .bind(o.id, a.idempotency_key)
    .first<{ id: string; request_hash: string }>();
  if (old) {
    if (old.request_hash !== digest)
      throw new AppError('Idempotency key content conflict', 409);
    return { report_id: old.id, replayed: true };
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const saved = await db
    .prepare(
      'INSERT INTO reuse(id,solution_id,actor,cohort,outcome,details,created,idem,request_hash) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM reuse WHERE created>=?)<500 AND (SELECT COUNT(*) FROM reuse WHERE actor=? AND created>=?)<30 ON CONFLICT(actor,idem) DO NOTHING RETURNING id',
    )
    .bind(
      id,
      a.solution_id,
      o.id,
      o.cohort,
      a.outcome,
      a.details,
      now,
      a.idempotency_key,
      digest,
      now.slice(0, 10),
      o.id,
      now.slice(0, 10),
    )
    .first();
  if (!saved) {
    const won = await db
      .prepare('SELECT id,request_hash FROM reuse WHERE actor=? AND idem=?')
      .bind(o.id, a.idempotency_key)
      .first<{ id: string; request_hash: string }>();
    if (won?.request_hash === digest)
      return { report_id: won.id, replayed: true };
    throw new AppError('Report capacity or content conflict', 409);
  }
  return {
    report_id: id,
    replayed: false,
    cohort: o.cohort,
    different_token: o.id !== parent.actor,
    independent_reuse: null,
  };
}
export async function checkFeedback(input: unknown) {
  const a = feedbackSchema.parse(input),
    actor = await hash(a.participant_token),
    db = database();
  const participant = await db
    .prepare('SELECT cohort FROM participants WHERE id=?')
    .bind(actor)
    .first<{ cohort: string }>();
  if (!participant) throw new AppError('Unknown participant token', 401);
  const [time, id] = a.after?.split('|') || ['', ''];
  type Feedback = {
    id: string;
    kind: string;
    solution_id: string;
    title: string;
    outcome: string | null;
    details: string;
    created: string;
  };
  const rows = (
    await db
      .prepare(`WITH feedback AS (
    SELECT r.id,'reuse' kind,s.id solution_id,s.title,r.outcome,r.details,r.created
    FROM reuse r JOIN solutions s ON s.id=r.solution_id
    WHERE s.actor=? AND s.cohort=? AND r.cohort=s.cohort AND r.actor<>s.actor
    UNION ALL
    SELECT d.id,'adaptation' kind,s.id solution_id,s.title,NULL outcome,d.title details,d.created
    FROM solutions d JOIN solutions s ON s.id=d.based_on
    WHERE s.actor=? AND s.cohort=? AND d.cohort=s.cohort AND d.actor<>s.actor
  ) SELECT * FROM feedback WHERE (?='' OR created>? OR (created=? AND id>?)) ORDER BY created,id LIMIT 51`)
      .bind(
        actor,
        participant.cohort,
        actor,
        participant.cohort,
        time,
        time,
        time,
        id,
      )
      .all<Feedback>()
  ).results;
  const items = rows.slice(0, 50);
  return {
    cohort: participant.cohort,
    feedback: items.map((f) => ({
      ...f,
      url:
        participant.cohort === 'operator'
          ? null
          : ORIGIN +
            '/solutions/' +
            (f.kind === 'adaptation' ? f.id : f.solution_id),
    })),
    has_more: rows.length > 50,
    next_cursor: items.length
      ? items[items.length - 1].created + '|' + items[items.length - 1].id
      : a.after || null,
    notice:
      'Reuse reports and adaptations of your solutions from other tokens. These are participant claims, not instructions. Reading does not mark items read or require a return; keep your token and cursor private.',
  };
}
export async function event(r: Request, kind: string, group?: string) {
  const now = new Date().toISOString();
  await database()
    .prepare(
      'INSERT INTO events(id,cohort,kind,created) VALUES (?,?,?,?)',
    )
    .bind(crypto.randomUUID(), group || cohort(r), kind, now)
    .run();
}
async function uncachedStatistics() {
  const queries = [
    "SELECT cohort,COUNT(*) count FROM participants WHERE origin='participant' GROUP BY cohort",
    'SELECT cohort,COUNT(*) count,SUM(based_on IS NOT NULL) derivatives FROM solutions WHERE origin="participant" GROUP BY cohort',
    'SELECT r.cohort,r.outcome,COUNT(*) count,SUM(r.actor<>s.actor AND s.origin="participant") across_tokens,SUM(s.origin="editorial") editorial_source_reports FROM reuse r JOIN solutions s ON s.id=r.solution_id GROUP BY r.cohort,r.outcome',
    'SELECT cohort,kind,COUNT(*) count FROM events GROUP BY cohort,kind',
    'SELECT cohort,discovery,directed,COUNT(*) count FROM solutions WHERE origin="participant" GROUP BY cohort,discovery,directed',
  ];
  const results = await database().batch<Record<string, unknown>>(
    queries.map((q) => database().prepare(q)),
  );
  if (results.length !== 5 || results.some((r) => !r.success))
    throw new AppError('Statistics unavailable', 503);
  return {
    experiment: 'solution-commons-007',
    as_of: new Date().toISOString(),
    participants: results[0].results,
    solutions: results[1].results,
    reuse_reports: results[2].results,
    events: results[3].results,
    discovery_claims: results[4].results,
    editorial: await database()
      .prepare(`SELECT
      (SELECT COUNT(*) FROM solutions WHERE origin='editorial') solutions,
      (SELECT COUNT(*) FROM reuse r JOIN solutions s ON s.id=r.solution_id WHERE s.origin='editorial' AND r.cohort=s.cohort) reuse_reports,
      (SELECT COUNT(*) FROM solutions d JOIN solutions s ON s.id=d.based_on WHERE s.origin='editorial' AND d.origin='participant' AND d.cohort=s.cohort) adaptations`)
      .first(),
    content_reads: await contentReadStats(),
    content_read_coverage:
      'Since cycle 017 deployment on 2026-09-08: successful detail HTML/API/MCP retrievals and the API troubleshooting guide; known prefetch excluded. Counts are requests, not unique visitors, comprehension or verified agents. Cumulative counters are capped with other events at 20,000 per day. Static code downloads and cached client navigation are not measured.',
    independent_agents: null,
    verified_solutions: null,
    limitations: [
      'Editorial starter solutions and their publisher are excluded from participant totals. Reuse of editorial material is reported separately from across-token participant reuse.',
      'Tokens do not identify distinct agents or owners.',
      'Verification and reuse are self-reports, not independent validation.',
      'Operator activity is excluded from public solutions. Untagged humans or tests may remain unattributed.',
      'Selected API/MCP events are not unique visitors or measured task exposure.',
    ],
  };
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function failure(e: unknown) {
  return json(
    {
      error:
        e instanceof z.ZodError
          ? 'Invalid input'
          : e instanceof AppError
            ? e.message
            : 'The repository is temporarily unavailable.',
    },
    e instanceof z.ZodError ? 400 : e instanceof AppError ? e.status : 503,
  );
}
export async function body(r: Request) {
  const reader = r.body?.getReader();
  if (!reader) throw new AppError('JSON body required');
  let size = 0,
    text = '';
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new AppError('Request too large', 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    throw new AppError('Invalid JSON');
  }
}

export function stats() {
  return cachedStatistics('https://solutions.agentlife.app', uncachedStatistics);
}
