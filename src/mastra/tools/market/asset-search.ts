import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { unwrapYahoo, yahooJson } from './yahoo';

export type AssetHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

export async function searchAsset(query: string, maxResults = 5): Promise<AssetHit[]> {
  const json = await yahooJson(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${maxResults * 3}&newsCount=0`,
  );
  const quotes = unwrapYahoo(json, `"${query}"`);
  const wanted = ['EQUITY', 'ETF', 'INDEX', 'CRYPTOCURRENCY', 'CURRENCY', 'FUTURE', 'MUTUALFUND'];
  return (quotes as any[])
    .filter(q => q.symbol && wanted.includes(q.quoteType))
    .slice(0, maxResults)
    .map(q => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      type: q.quoteType,
      exchange: q.exchDisp || q.exchange || '',
    }));
}

export const assetSearchTool = createTool({
  id: 'asset-search',
  description:
    'Resuelve nombres o tickers de activos (acciones, ETFs, índices, cripto, divisas, futuros) a símbolos de Yahoo Finance. Úsala antes de quote/historical-prices si no tienes el símbolo exacto.',
  inputSchema: z.object({
    query: z.string().describe('Nombre de empresa/asset o ticker parcial (p. ej. "apple", "santander", "bitcoin")'),
    maxResults: z.number().int().min(1).max(10).default(5).describe('Número máximo de coincidencias'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        symbol: z.string(),
        name: z.string(),
        type: z.string(),
        exchange: z.string(),
      }),
    ),
  }),
  execute: async input => ({ results: await searchAsset(input.query, input.maxResults) }),
});
