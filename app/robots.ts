import { ORIGIN } from '@/lib/commons';
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/reuse', '/api/mcp'] },
    sitemap: ORIGIN + '/sitemap.xml',
  };
}
