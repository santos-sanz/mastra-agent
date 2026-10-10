import { createTool } from '@mastra/core/tools';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { unwrapYahoo, yahooJson } from './yahoo';

export type PriceSeries = {
  symbol: string;
  currency: string;
  range: string;
  timestamps: number[];
  closes: number[];
};

const VALID_RANGES = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max'] as const;
const VALID_INTERVALS = ['1h', '1d', '1wk', '1mo'] as const;

export async function getHistorical(symbol: string, range = '1y', interval = '1d'): Promise<PriceSeries> {
  if (!VALID_RANGES.includes(range as any)) throw new Error(`Rango inválido "${range}". Usa: ${VALID_RANGES.join(', ')}`);
  if (!VALID_INTERVALS.includes(interval as any)) throw new Error(`Intervalo inválido "${interval}". Usa: ${VALID_INTERVALS.join(', ')}`);
  const result = unwrapYahoo(
    await yahooJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`),
    symbol,
  );
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
  const pairs = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter(p => typeof p.c === 'number' && Number.isFinite(p.c));
  if (pairs.length < 2) throw new Error(`Serie histórica insuficiente para ${symbol} (${pairs.length} puntos)`);
  return {
    symbol,
    currency: result.meta?.currency ?? '',
    range,
    timestamps: pairs.map(p => p.t),
    closes: pairs.map(p => p.c),
  };
}

export function seriesMetrics(series: PriceSeries) {
  const first = series.closes[0];
  const last = series.closes[series.closes.length - 1];
  const returns = series.closes.slice(1).map((c, i) => c / series.closes[i] - 1);
  const mean = returns.reduce((a, r) => a + r, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  return {
    changePercent: ((last - first) / first) * 100,
    min: Math.min(...series.closes),
    max: Math.max(...series.closes),
    annualizedVolatilityPct: dailyVol * Math.sqrt(252) * 100,
    points: series.closes.length,
  };
}

function buildSvg(series: PriceSeries, metrics: ReturnType<typeof seriesMetrics>): string {
  const W = 800;
  const H = 320;
  const PAD = 44;
  const { closes, timestamps } = series;
  const min = metrics.min;
  const max = metrics.max;
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (closes.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const line = closes.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(' ');
  const area = `${line} L${x(closes.length - 1).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const firstDate = new Date(timestamps[0] * 1000).toLocaleDateString('es-ES');
  const lastDate = new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString('es-ES');
  const color = metrics.changePercent >= 0 ? '#3fb950' : '#f85149';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,sans-serif">
  <rect width="${W}" height="${H}" fill="#0d1117" rx="12"/>
  <path d="${area}" fill="${color}" opacity="0.12"/>
  <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5"/>
  <text x="${PAD}" y="26" fill="#e6edf3" font-size="16" font-weight="600">${series.symbol} · ${series.range}</text>
  <text x="${W - PAD}" y="26" fill="${color}" font-size="14" text-anchor="end">${metrics.changePercent >= 0 ? '+' : ''}${metrics.changePercent.toFixed(2)}%</text>
  <text x="${PAD}" y="${H - 12}" fill="#8b949e" font-size="11">${firstDate}</text>
  <text x="${W - PAD}" y="${H - 12}" fill="#8b949e" font-size="11" text-anchor="end">${lastDate}</text>
  <text x="${PAD}" y="${y(max) - 6}" fill="#8b949e" font-size="11">${max.toFixed(2)} ${series.currency}</text>
  <text x="${PAD}" y="${y(min) + 14}" fill="#8b949e" font-size="11">${min.toFixed(2)} ${series.currency}</text>
</svg>`;
}

export async function priceChart(symbol: string, range = '1y', interval = '1d') {
  const series = await getHistorical(symbol, range, interval);
  const metrics = seriesMetrics(series);
  const svg = buildSvg(series, metrics);
  const dir = join(process.cwd(), 'generated');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `chart-${symbol.replace(/[^A-Za-z0-9._-]/g, '_')}-${Date.now()}.svg`);
  await writeFile(path, svg, 'utf8');
  return { path, ...metrics, currency: series.currency };
}

export const historicalPricesTool = createTool({
  id: 'historical-prices',
  description:
    'Serie histórica de precios de un activo (rango e intervalo configurables) con métricas: variación del periodo, mínimo, máximo y volatilidad anualizada. Genera también un gráfico SVG en ./generated/.',
  inputSchema: z.object({
    symbol: z.string().describe('Símbolo de Yahoo Finance'),
    range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max']).default('1y').describe('Rango temporal'),
    interval: z.enum(['1h', '1d', '1wk', '1mo']).default('1d').describe('Intervalo de las velas'),
  }),
  outputSchema: z.object({
    path: z.string(),
    changePercent: z.number(),
    min: z.number(),
    max: z.number(),
    annualizedVolatilityPct: z.number(),
    points: z.number(),
    currency: z.string(),
  }),
  execute: async input => priceChart(input.symbol, input.range, input.interval),
});
