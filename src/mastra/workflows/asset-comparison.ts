import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { writerAgent } from '../agents/writer-agent';
import { getHistorical, seriesMetrics } from '../tools/market/historical-prices';
import { getFinancials } from '../tools/market/financials';
import { getQuote } from '../tools/market/quote';

const assetRowSchema = z.object({
  symbol: z.string(),
  ok: z.boolean(),
  price: z.number().nullable(),
  currency: z.string(),
  changePercent: z.number().nullable(),
  return1yPct: z.number().nullable(),
  annualizedVolPct: z.number().nullable(),
  trailingPE: z.number().nullable(),
  marketCap: z.number().nullable(),
  error: z.string().nullable(),
});

const collectData = createStep({
  id: 'collect-data',
  description: 'Para cada activo: quote, serie 1y (rentabilidad y volatilidad) y fundamentales si es equity.',
  inputSchema: z.object({ symbols: z.array(z.string()).min(2).max(5).describe('Símbolos a comparar') }),
  outputSchema: z.object({ assets: z.array(assetRowSchema) }),
  execute: async ({ inputData }) => {
    const { symbols } = inputData;
    const assets = await Promise.all(
      symbols.map(async symbol => {
        try {
          const [quote, series, financials] = await Promise.all([
            getQuote(symbol).catch(() => null),
            getHistorical(symbol, '1y', '1wk').catch(() => null),
            getFinancials(symbol).catch(() => null),
          ]);
          const metrics = series ? seriesMetrics(series) : null;
          return {
            symbol,
            ok: !!quote || !!metrics,
            price: quote?.price ?? null,
            currency: quote?.currency ?? series?.currency ?? '',
            changePercent: quote?.changePercent ?? null,
            return1yPct: metrics?.changePercent ?? null,
            annualizedVolPct: metrics?.annualizedVolatilityPct ?? null,
            trailingPE: financials?.trailingPE ?? null,
            marketCap: financials?.marketCap ?? null,
            error: quote || metrics ? null : 'sin datos en la fuente',
          };
        } catch (e) {
          return {
            symbol,
            ok: false,
            price: null,
            currency: '',
            changePercent: null,
            return1yPct: null,
            annualizedVolPct: null,
            trailingPE: null,
            marketCap: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );
    return { assets };
  },
});

const writeComparison = createStep({
  id: 'write-comparison',
  description: 'El writer produce la comparativa con tabla, fortalezas/ debilidades y veredicto relativo.',
  inputSchema: z.object({ assets: z.array(assetRowSchema) }),
  outputSchema: z.object({ report: z.string() }),
  execute: async ({ inputData }) => {
    const { assets } = inputData;
    const table = assets
      .map(a =>
        `- ${a.symbol}: precio ${a.price ?? 'n/d'} ${a.currency}, variación hoy ${a.changePercent?.toFixed(2) ?? 'n/d'}%, rentabilidad 1y ${a.return1yPct?.toFixed(1) ?? 'n/d'}%, volatilidad anualizada ${a.annualizedVolPct?.toFixed(1) ?? 'n/d'}%, P/E ${a.trailingPE ?? 'n/d'}, cap. mercado ${a.marketCap ?? 'n/d'}${a.error ? ` (ERROR: ${a.error})` : ''}`,
      )
      .join('\n');
    const res = await writerAgent.generate(
      `Compara estos activos tradeables en un informe markdown:\n${table}\n\n` +
        `Estructura: ## Tabla comparativa (markdown con las métricas) · ## Análisis por activo (fortalezas y debilidades según los datos, indicando cuáles faltan) · ## Veredicto relativo (perfil de riesgo/retorno, para qué tipo de inversor encaja cada uno) · ## Fuentes (Yahoo Finance, dato con retardo posible).\n` +
        `Cierra SIEMPRE con: "⚠️ Esto es información educativa, no asesoramiento financiero. Haz tu propia investigación (DYOR)."`,
    );
    return { report: res.text };
  },
});

export const assetComparisonWorkflow = createWorkflow({
  id: 'asset-comparison-workflow',
  description: 'Compara 2-5 activos tradeables: precio, rentabilidad 1y, volatilidad, valuación y veredicto relativo.',
  inputSchema: z.object({ symbols: z.array(z.string()).min(2).max(5).describe('Símbolos de Yahoo Finance a comparar') }),
  outputSchema: z.object({ report: z.string() }),
})
  .then(collectData)
  .then(writeComparison)
  .commit();
