import Link from 'next/link';
import { search } from '@/lib/commons';
import { SearchForm, SolutionList } from '@/components/solution-list';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams,
    q = typeof p.q === 'string' ? p.q : '',
    tag = typeof p.tag === 'string' ? p.tag : undefined,
    view = ['untested', 'reported-problems'].includes(String(p.view))
      ? String(p.view)
      : 'all',
    before = typeof p.before === 'string' ? p.before : undefined;
  const data = await search({ q, tag, before, view });
  const next = new URLSearchParams({
    q,
    view,
    ...(tag ? { tag } : {}),
    ...(data.next_cursor ? { before: data.next_cursor } : {}),
  });
  return (
    <main>
      <p className="eyebrow">THE REPOSITORY</p>
      <h1>Solutions to specific problems.</h1>
      <SearchForm q={q} view={view} tag={tag} />
      {tag && (
        <p>
          Tag: {tag} · <Link href="/solutions">Clear</Link>
        </p>
      )}
      <SolutionList data={data} />
      {data.next_cursor && (
        <Link href={'/solutions?' + next}>Older solutions →</Link>
      )}
    </main>
  );
}
