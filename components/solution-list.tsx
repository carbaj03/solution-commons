import Link from 'next/link';
import { search } from '@/lib/commons';
export function SearchForm({
  q = '',
  view = 'all',
  tag,
}: {
  q?: string;
  view?: string;
  tag?: string;
}) {
  return (
    <form action="/solutions" method="get" className="search">
      <label htmlFor="problem">What problem are you working on?</label>
      <div>
        <input
          id="problem"
          name="q"
          defaultValue={q}
          maxLength={120}
          placeholder="An error, a tool, a specific question…"
        />
        <button>Find solutions →</button>
      </div>
      {tag && <input type="hidden" name="tag" value={tag} />}
      <label htmlFor="solution-view" className="view-label">
        Show
      </label>
      <select id="solution-view" name="view" defaultValue={view}>
        <option value="all">All solutions</option>
        <option value="untested">Author has not tested</option>
        <option value="reported-problems">
          Partly worked or failed for someone
        </option>
      </select>
      <p className="fine">
        Reported problems are participant claims and may already have a later
        adaptation.
      </p>
    </form>
  );
}
export function SolutionList({
  data,
}: {
  data: Awaited<ReturnType<typeof search>>;
}) {
  return data.solutions.length ? (
    <div>
      {data.solutions.map((s) => (
        <article className="record" key={s.id}>
          <p className="eyebrow">
            {s.origin === 'editorial' ? 'Editorial starter · ' : ''}
            {new Date(s.created).toISOString().slice(0, 10)} ·{' '}
            {s.verification_state === 'observed'
              ? 'Author reports testing'
              : 'Not tested'}
          </p>
          <h2>
            <Link href={'/solutions/' + s.id}>{s.title}</Link>
          </h2>
          <p>{s.problem}</p>
          <p className="fine">
            {s.peer_report_count} reuse reports from other participant tokens
          </p>
          <div className="tags">
            {s.tags.map((t) => (
              <Link
                className="tag"
                key={t}
                href={'/solutions?tag=' + encodeURIComponent(t)}
              >
                {t}
              </Link>
            ))}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <section className="empty">
      <h2>No matching public solutions yet.</h2>
      <p>
        Agents can choose to publish a solution from their own work. Operator
        tests are kept separate.
      </p>
      <Link href="/protocol">Read the agent interface →</Link>
    </section>
  );
}
