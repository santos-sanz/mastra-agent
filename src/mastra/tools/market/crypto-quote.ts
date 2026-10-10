import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const CG = 'https://api.coingecko.com/api/v3';

export type CryptoQuote = {
  id: string;
  symbol: string;
  name: string;
  price: Record<string, number>;
  change24hPct: number | null;
  marketCap: number | null;
};

export async function searchCryptoId(query: string): Promise<{ id: string; name: string; symbol: string } | null> {
  const res = await fetch(`${CG}/search?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const json = (await res.json()) as { coins?: { id: string; name: string; symbol: string; market_cap_rank: number }[] };
  const coins = (json.coins ?? []).slice().sort((a, b) => (a.market_cap_rank ?? 999) - (b.market_cap_rank ?? 999));
  return coins[0] ? { id: coins[0].id, name: coins[0].name, symbol: coins[0].symbol.toUpperCase() } : null;
}

export async function getCryptoQuotes(queries: string[], vsCurrencies = 'usd,eur'): Promise<CryptoQuote[]> {
  const ids: string[] = [];
  const resolved: { id: string; name: string; symbol: string }[] = [];
  for (const q of queries) {
    const hit = await searchCryptoId(q);
    if (hit && !ids.includes(hit.id)) {
      ids.push(hit.id);
      resolved.push(hit);
    }
  }
  if (ids.length === 0) throw new Error(`No se encontraron criptos para: ${queries.join(', ')}`);

  const res = await fetch(
    `${CG}/simple/price?ids=${ids.join(',')}&vs_currencies=${vsCurrencies}&include_24hr_change=true&include_market_cap=true`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, number>>;

  return resolved
    .filter(r => data[r.id])
    .map(r => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      price: Object.fromEntries(
        vsCurrencies.split(',').map(cur => [cur.toUpperCase(), data[r.id][cur] ?? data[r.id][`_${cur}`] ?? 0]),
      ),
      change24hPct: data[r.id][`usd_24h_change`] ?? null,
      marketCap: data[r.id]['usd_market_cap'] ?? null,
    }));
}

export const cryptoQuoteTool = createTool({
  id: 'crypto-quote',
  description:
    'Precio actual de criptomonedas en USD/EUR con variación 24h y capitalización de mercado (CoinGecko). Acepta nombres o símbolos ("bitcoin", "eth", "sol").',
  inputSchema: z.object({
    coins: z.array(z.string()).min(1).max(10).describe('Nombres o símbolos de criptos (p. ej. ["bitcoin","eth"])'),
  }),
  outputSchema: z.object({
    quotes: z.array(
      z.object({
        id: z.string(),
        symbol: z.string(),
        name: z.string(),
        price: z.record(z.string(), z.number()),
        change24hPct: z.number().nullable(),
        marketCap: z.number().nullable(),
      }),
    ),
  }),
  execute: async input => ({ quotes: await getCryptoQuotes(input.coins) }),
});
