import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const FRANKFURTER = 'https://api.frankfurter.dev/v1';

export type FxRate = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

export async function getFxRates(base: string, symbols: string[]): Promise<FxRate> {
  const url = `${FRANKFURTER}/latest?base=${base.toUpperCase()}${symbols.length ? `&symbols=${symbols.map(s => s.toUpperCase()).join(',')}` : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const json = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
  return { base: json.base, date: json.date, rates: json.rates };
}

export async function getFxHistory(base: string, symbols: string[], startDate: string): Promise<FxRate[]> {
  const url = `${FRANKFURTER}/${startDate}..?base=${base.toUpperCase()}${symbols.length ? `&symbols=${symbols.map(s => s.toUpperCase()).join(',')}` : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const json = (await res.json()) as { base: string; rates: Record<string, Record<string, number>> };
  return Object.entries(json.rates).map(([date, rates]) => ({ base: json.base, date, rates }));
}

export const fxRatesTool = createTool({
  id: 'fx-rates',
  description:
    'Tipos de cambio de referencia del BCE (Frankfurter): precio actual entre divisas (EUR, USD, GBP, JPY, CHF...) con opción de serie histórica. Sin cripto: para cripto usa crypto-quote.',
  inputSchema: z.object({
    base: z.string().default('EUR').describe('Divisa base (p. ej. EUR, USD)'),
    symbols: z.array(z.string()).default([]).describe('Divisas destino (p. ej. ["USD","GBP"])'),
    startDate: z.string().optional().describe('Fecha ISO (YYYY-MM-DD) para serie histórica desde esa fecha'),
  }),
  outputSchema: z.object({
    rates: z.array(
      z.object({
        base: z.string(),
        date: z.string(),
        rates: z.record(z.string(), z.number()),
      }),
    ),
  }),
  execute: async input =>
    input.startDate
      ? { rates: await getFxHistory(input.base, input.symbols, input.startDate) }
      : { rates: [await getFxRates(input.base, input.symbols)] },
});
