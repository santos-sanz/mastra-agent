import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { tavilySearch } from './web-search';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

export type NewsItem = { title: string; url: string; source: string; date: string | null };

async function googleNews(query: string, maxResults: number, lang = 'es'): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${lang.toUpperCase()}&ceid=${lang.toUpperCase()}:${lang}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const news: NewsItem[] = [];
  for (const item of items) {
    if (news.length >= maxResults) break;
    const body = item[1];
    const title = body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? '';
    const link = body.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? '';
    const source = body.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? '';
    const date = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? null;
    if (title && link) news.push({ title, url: link, source, date });
  }
  return news;
}

export async function marketNews(query: string, maxResults = 6, lang = 'es'): Promise<NewsItem[]> {
  try {
    const rss = await googleNews(query, maxResults, lang);
    if (rss.length >= 2) return rss;
  } catch {
    /* fallthrough */
  }
  const tavily = await tavilySearch(`${query} últimas noticias`, maxResults);
  return tavily.map(r => ({ title: r.title, url: r.url, source: 'Tavily', date: null }));
}

export const marketNewsTool = createTool({
  id: 'market-news',
  description:
    'Busca noticias recientes de mercado, empresas o economía (Google News RSS, con fallback a Tavily). Devuelve titulares con fuente y fecha. Úsala para actualidad sobre empresas, activos o eventos macro.',
  inputSchema: z.object({
    query: z.string().describe('Tema de búsqueda de noticias (empresa, ticker, sector o tema macro)'),
    maxResults: z.number().int().min(1).max(10).default(6).describe('Número máximo de titulares'),
    lang: z.string().default('es').describe('Idioma de las noticias (es, en...)'),
  }),
  outputSchema: z.object({
    news: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        source: z.string(),
        date: z.string().nullable(),
      }),
    ),
  }),
  execute: async input => ({ news: await marketNews(input.query, input.maxResults, input.lang) }),
});
