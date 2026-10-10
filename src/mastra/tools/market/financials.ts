import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { unwrapYahoo, yahooJson } from './yahoo';

export type Financials = {
  symbol: string;
  currency: string;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  beta: number | null;
  profitMarginPct: number | null;
  operatingMarginPct: number | null;
  grossMarginPct: number | null;
  returnOnEquityPct: number | null;
  revenueGrowthPct: number | null;
  debtToEquity: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  targetMeanPrice: number | null;
  recommendation: string | null;
  shortFloatPct: number | null;
};

const nullable = (v: any): number | null => (typeof v === 'number' ? v : null);

export async function getFinancials(symbol: string): Promise<Financials> {
  const result = unwrapYahoo(
    await yahooJson(
      `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics,summaryDetail,price`,
      { crumb: true },
    ),
    symbol,
  );
  const fd = result.financialData ?? {};
  const ks = result.defaultKeyStatistics ?? {};
  const sd = result.summaryDetail ?? {};
  const price = result.price ?? {};
  const pct = (v: any) => (typeof v === 'number' ? v * 100 : null);

  return {
    symbol,
    currency: price.currency ?? 'USD',
    marketCap: nullable(price.marketCap?.raw ?? sd.marketCap?.raw),
    enterpriseValue: nullable(ks.enterpriseValue?.raw),
    trailingPE: nullable(sd.trailingPE?.raw ?? ks.trailingPE?.raw),
    forwardPE: nullable(ks.forwardPE?.raw ?? sd.forwardPE?.raw),
    beta: nullable(sd.beta?.raw ?? ks.beta?.raw),
    grossMarginPct: pct(fd.grossMargins?.raw),
    operatingMarginPct: pct(fd.operatingMargins?.raw),
    profitMarginPct: pct(fd.profitMargins?.raw),
    returnOnEquityPct: pct(fd.returnOnEquity?.raw),
    revenueGrowthPct: pct(fd.revenueGrowth?.raw),
    debtToEquity: nullable(fd.debtToEquity?.raw),
    totalCash: nullable(fd.totalCash?.raw),
    totalDebt: nullable(fd.totalDebt?.raw),
    targetMeanPrice: nullable(fd.targetMeanPrice?.raw),
    recommendation: fd.recommendationKey ?? null,
    shortFloatPct: pct(ks.shortPercentOfFloat?.raw),
  };
}

export const financialsTool = createTool({
  id: 'financials',
  description:
    'Fundamentales de una empresa cotizada: capitalización, EV, P/E (actual y forward), beta, márgenes, ROE, crecimiento de ingresos, deuda, precio objetivo medio de analistas y recomendación. Solo empresas públicas.',
  inputSchema: z.object({
    symbol: z.string().describe('Símbolo de Yahoo Finance (p. ej. AAPL, SAN.MC)'),
  }),
  outputSchema: z.object({
    financials: z.object({
      symbol: z.string(),
      currency: z.string(),
      marketCap: z.number().nullable(),
      enterpriseValue: z.number().nullable(),
      trailingPE: z.number().nullable(),
      forwardPE: z.number().nullable(),
      beta: z.number().nullable(),
      profitMarginPct: z.number().nullable(),
      operatingMarginPct: z.number().nullable(),
      grossMarginPct: z.number().nullable(),
      returnOnEquityPct: z.number().nullable(),
      revenueGrowthPct: z.number().nullable(),
      debtToEquity: z.number().nullable(),
      totalCash: z.number().nullable(),
      totalDebt: z.number().nullable(),
      targetMeanPrice: z.number().nullable(),
      recommendation: z.string().nullable(),
      shortFloatPct: z.number().nullable(),
    }),
  }),
  execute: async input => ({ financials: await getFinancials(input.symbol) }),
});
