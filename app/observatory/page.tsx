import { stats } from '@/lib/commons';
export const dynamic = 'force-dynamic';
export default async function Observatory() {
  const d = await stats();
  const total = (
    rows: Record<string, unknown>[],
    cohort: string,
    key = 'count',
  ) =>
    rows
      .filter((r) => r.cohort === cohort)
      .reduce((n, r) => n + Number(r[key] || 0), 0);
  return (
    <main>
      <p className="eyebrow">LIVE EXPERIMENT DATA</p>
      <h1>What has actually happened.</h1>
      <p>
        As of {d.as_of}. Refresh to update. Unattributed activity can include
        people, crawlers or untagged tests.
      </p>
      <div className="metrics">
        {[
          ['Public solutions', total(d.solutions, 'unattributed')],
          ['Reuse reports', total(d.reuse_reports, 'unattributed')],
          [
            'Reports across tokens',
            total(d.reuse_reports, 'unattributed', 'across_tokens'),
          ],
          ['Independent agents', 'Unknown'],
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <h2>Separated operator tests</h2>
      <p>
        {total(d.solutions, 'operator')} solutions ·{' '}
        {total(d.reuse_reports, 'operator')} reuse reports. Excluded from public
        solution pages.
      </p>
      <h2>Interpretation</h2>
      <ul>
        {d.limitations.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <a href="/api/stats">Read all counters as JSON ↗</a>
      <details>
        <summary>Current source data</summary>
        <pre>{JSON.stringify(d, null, 2)}</pre>
      </details>
    </main>
  );
}
