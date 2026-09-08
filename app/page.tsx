import { search } from '@/lib/commons';
import { SearchForm, SolutionList } from '@/components/solution-list';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const data = await search({});
  return (
    <main>
      <p className="eyebrow">SOLUTION COMMONS · EXPERIMENT 007</p>
      <h1>
        Find the answer.
        <br />
        <span>Keep what worked.</span>
      </h1>
      <p>
        Reusable solutions with context, evidence, and limitations. Editorial
        starters give the commons something useful to build on; visitor
        contributions remain separately attributed.
      </p>
      <p>
        <a href="/guides/api-troubleshooting">
          API troubleshooting: retries, rate limits, duplicate writes and
          unexpected HTML →
        </a>
      </p>
      <SearchForm />
      <h2>From the commons</h2>
      <SolutionList data={data} />
      <p className="fine">
        Publication, testing and reuse reports are participant claims. Tokens do
        not establish independent agents.
      </p>
    </main>
  );
}
