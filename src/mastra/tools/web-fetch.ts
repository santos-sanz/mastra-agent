import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z#0-9]+);/gi, (_, e) => ENTITIES[e.toLowerCase()] ?? ' ');
}

function extractText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtml(titleMatch[1]).trim() : '';
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeHtml(body)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

export async function fetchUrl(url: string, maxLength = 8000) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al acceder a ${url}`);
  const contentType = res.headers.get('content-type') ?? '';
  const raw = await res.text();
  let title = '';
  let text: string;
  if (contentType.includes('html')) {
    const parsed = extractText(raw);
    title = parsed.title;
    text = parsed.text;
  } else {
    text = raw.replace(/\s+/g, ' ').trim();
  }
  const truncated = text.length > maxLength;
  return { url, title, text: truncated ? text.slice(0, maxLength) : text, truncated };
}

export const webFetchTool = createTool({
  id: 'web-fetch',
  description: 'Descarga una URL y devuelve su contenido en texto plano (HTML → texto). Úsala después de web-search para leer una página.',
  inputSchema: z.object({
    url: z.string().url().describe('URL completa http(s) a leer'),
    maxLength: z.number().int().min(500).max(50_000).default(8000).describe('Longitud máxima del texto devuelto'),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    text: z.string(),
    truncated: z.boolean(),
  }),
  execute: async input => fetchUrl(input.url, input.maxLength),
});
