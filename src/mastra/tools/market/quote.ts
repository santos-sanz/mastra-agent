import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { unwrapYahoo, yahooJson } from './yahoo';

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  exchange: string;
  previousClose: number;
  changePercent: number;
  dayLow: number | null;
  dayHigh: number | null;
  volume: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  marketTime: string;
};

export async function getQuote(symbol: string): Promise<Quote> {
  const result = unwrapYahoo(
    await yahooJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`),
    symbol,
  );
  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  if (typeof price !== 'number') throw new Error(`Yahoo no devolvió precio para ${symbol}`);
  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    price,
    currency: meta.currency ?? '',
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
    previousClose: prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    dayLow: meta.regularMarketDayLow ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    volume: meta.regularMarketVolume ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : '',
  };
}

export const quoteTool = createTool({
  id: 'quote',
  description:
    'Precio actual de un activo (acción, ETF, índice, cripto, divisa) con variación diaria, rango del día, volumen y máximos/mínimos de 52 semanas. Datos de Yahoo Finance, pueden ir con retardo de hasta 15 minutos.',
  inputSchema: z.object({
    symbol: z.string().describe('Símbolo de Yahoo Finance (p. ej. AAPL, SAN.MC, BTC-USD, ^IBEX, EURUSD=X)'),
  }),
  outputSchema: z.object({
    quote: z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      currency: z.string(),
      exchange: z.string(),
      previousClose: z.number(),
      changePercent: z.number(),
      dayLow: z.number().nullable(),
      dayHigh: z.number().nullable(),
      volume: z.number().nullable(),
      fiftyTwoWeekLow: z.number().nullable(),
      fiftyTwoWeekHigh: z.number().nullable(),
      marketTime: z.string(),
    }),
  }),
  execute: async input => ({ quote: await getQuote(input.symbol) }),
});
