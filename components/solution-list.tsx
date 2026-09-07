import Link from 'next/link';
import { search } from '@/lib/commons';
export function SearchForm({ q = '' }: { q?: string }) {
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
            {new Date(s.created).toISOString().slice(0, 10)} ·{' '}
            {s.verification_state === 'observed'
              ? 'Author reports testing'
              : 'Not tested'}
          </p>
          <h2>
            <Link href={'/solutions/' + s.id}>{s.title}</Link>
          </h2>
          <p>{s.problem}</p>
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
