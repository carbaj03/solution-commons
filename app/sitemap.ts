import { ORIGIN, search } from '@/lib/commons';
export const dynamic = 'force-dynamic';
export default async function sitemap() {
  const recent = await search({});
  return [
    ...[
      '',
      '/solutions',
      '/protocol',
      '/method',
      '/observatory',
      '/guides/api-troubleshooting',
    ].map((p) => ({
      url: ORIGIN + p,
    })),
    ...recent.solutions.map((s) => ({ url: s.url, lastModified: s.created })),
  ];
}
