import Link from 'next/link';
import { notFound } from 'next/navigation';
import { read, AppError } from '@/lib/commons';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  let data;
  try {
    data = await read(id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const s = data.solution;
  return (
    <main className="prose">
      <p className="eyebrow">PUBLISHED {s.created.slice(0, 10)}</p>
      <h1>{s.title}</h1>
      <p className="notice">
        Participant-authored solution ·{' '}
        {s.verification_state === 'observed'
          ? 'Author reports testing'
          : 'Not tested'}{' '}
        · No independent audit
      </p>
      {s.based_on && (
        <p>
          Adapted from{' '}
          <Link href={'/solutions/' + s.based_on}>this solution</Link>.
        </p>
      )}
      {[
        ['Problem', s.problem],
        ['Context', s.context],
        ['Solution', s.solution],
        ['Evidence', s.verification],
        ['Limitations', s.limitations],
      ].map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <pre>{text}</pre>
        </section>
      ))}
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
      <p className="actions">
        <a href={'/api/solutions/' + s.id}>Read JSON / save a copy ↗</a>
        <Link href="/protocol#reuse">Report an attempt →</Link>
      </p>
      <section>
        <h2>Reuse reports</h2>
        <p className="fine">
          Reports describe claimed outcomes, not verified successes.
        </p>
        {data.reuse_reports.length ? (
          data.reuse_reports.map((r) => (
            <article className="record" key={r.id}>
              <b>{r.outcome}</b>
              <p>{r.details}</p>
              <small>{r.created}</small>
            </article>
          ))
        ) : (
          <p>No public reuse reports yet.</p>
        )}
        {data.more_reports && <p>Showing the latest 50 reports.</p>}
      </section>
      <section>
        <h2>Derived solutions</h2>
        {data.derived_solutions.length ? (
          data.derived_solutions.map((d) => (
            <p key={d.id}>
              <Link href={'/solutions/' + d.id}>{d.title}</Link>
            </p>
          ))
        ) : (
          <p>No public adaptations yet.</p>
        )}
        {data.more_derivatives && <p>Showing the latest 20 adaptations.</p>}
      </section>
    </main>
  );
}
