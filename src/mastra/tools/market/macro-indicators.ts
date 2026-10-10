import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const WB = 'https://api.worldbank.org/v2';

export const MACRO_INDICATORS: Record<string, { code: string; label: string }> = {
  pib: { code: 'NY.GDP.MKTP.KD.ZG', label: 'Crecimiento del PIB (anual %)' },
  'gdp-growth': { code: 'NY.GDP.MKTP.KD.ZG', label: 'Crecimiento del PIB (anual %)' },
  inflacion: { code: 'FP.CPI.TOTL.ZG', label: 'Inflación, IPC (anual %)' },
  inflation: { code: 'FP.CPI.TOTL.ZG', label: 'Inflación, IPC (anual %)' },
  desempleo: { code: 'SL.UEM.TOTL.ZS', label: 'Desempleo (% de la fuerza laboral)' },
  unemployment: { code: 'SL.UEM.TOTL.ZS', label: 'Desempleo (% de la fuerza laboral)' },
  'deuda-publica': { code: 'GC.DOD.TOTL.GD.ZS', label: 'Deuda pública (% del PIB)' },
  'gdp-per-capita': { code: 'NY.GDP.PCAP.CD', label: 'PIB per cápita (USD actuales)' },
  'inversion-fija': { code: 'NE.GDI.FTOT.ZS', label: 'Inversión en capital fijo (% del PIB)' },
};

const COUNTRY_CODES: Record<string, string> = {
  españa: 'ESP',
  espana: 'ESP',
  'spain': 'ESP',
  estados_unidos: 'USA',
  'estados unidos': 'USA',
  usa: 'USA',
  'eeuu': 'USA',
  alemania: 'DEU',
  germany: 'DEU',
  francia: 'FRA',
  france: 'FRA',
  mexico: 'MEX',
  argentina: 'ARG',
  colombia: 'COL',
  chile: 'CHL',
  portugal: 'PRT',
  italia: 'ITA',
  japan: 'JPN',
  japon: 'JPN',
  china: 'CHN',
  'reino unido': 'GBR',
  uk: 'GBR',
};

export type MacroPoint = { year: string; value: number | null };
export type MacroSeries = { country: string; indicator: string; label: string; points: MacroPoint[] };

export async function getMacro(country: string, indicator: string, years = 5): Promise<MacroSeries> {
  const countryCode = COUNTRY_CODES[country.trim().toLowerCase()] ?? country.trim().toUpperCase().slice(0, 3);
  const ind = MACRO_INDICATORS[indicator.trim().toLowerCase()];
  const code = ind?.code ?? indicator.trim();
  const label = ind?.label ?? indicator;

  const res = await fetch(`${WB}/country/${countryCode}/indicator/${code}?format=json&date=2015:2025&per_page=20`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`World Bank HTTP ${res.status} (país=${countryCode}, indicador=${code})`);
  const json = (await res.json()) as [any, { date: string; value: number | null; country?: { value?: string } }[] | null];
  if (!Array.isArray(json) || !Array.isArray(json[1])) throw new Error(`World Bank sin datos para ${countryCode}/${code}`);
  const points = json[1]
    .filter(p => p.value !== null)
    .slice(0, years)
    .map(p => ({ year: p.date, value: p.value }));
  if (points.length === 0) throw new Error(`Sin valores disponibles para ${countryCode}/${code}`);
  return { country: json[1][0]?.country?.value ?? countryCode, indicator: code, label, points };
}

export const macroIndicatorsTool = createTool({
  id: 'macro-indicators',
  description:
    'Indicadores macroeconómicos oficiales del Banco Mundial: crecimiento del PIB, inflación (IPC), desempleo, deuda pública, PIB per cápita... por país y últimos años. Nombres aceptados: pib, inflacion, desempleo, deuda-publica, gdp-per-capita.',
  inputSchema: z.object({
    country: z.string().describe('País (nombre o código ISO3, p. ej. "España", "USA")'),
    indicator: z.string().describe('Indicador (p. ej. "pib", "inflacion", "desempleo" o código del Banco Mundial)'),
    years: z.number().int().min(1).max(10).default(5).describe('Número de años a recuperar'),
  }),
  outputSchema: z.object({
    series: z.object({
      country: z.string(),
      indicator: z.string(),
      label: z.string(),
      points: z.array(z.object({ year: z.string(), value: z.number().nullable() })),
    }),
  }),
  execute: async input => ({ series: await getMacro(input.country, input.indicator, input.years) }),
});
