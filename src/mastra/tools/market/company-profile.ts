import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { unwrapYahoo, yahooJson } from './yahoo';
import { searchAsset, type AssetHit } from './asset-search';
import { tavilySearch } from '../web-search';

export type CompanyProfile = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  employees: number | null;
  description: string | null;
  source: 'yahoo' | 'wikipedia' | 'web';
};

type YahooSummaryProfile = {
  sector?: string;
  industry?: string;
  website?: string;
  country?: string;
  fullTimeEmployees?: string;
  longBusinessSummary?: string;
};

export async function getProfile(symbolOrName: string): Promise<CompanyProfile> {
  const symbols = await searchAsset(symbolOrName, 5).catch(() => [] as AssetHit[]);
  const equity = symbols.find(h => h.type === 'EQUITY');

  if (equity) {
    try {
      const result = unwrapYahoo(
        await yahooJson(
          `/v10/finance/quoteSummary/${encodeURIComponent(equity.symbol)}?modules=summaryProfile,price`,
          { crumb: true },
        ),
        equity.symbol,
      );
      const sp: YahooSummaryProfile = result.summaryProfile ?? {};
      return {
        symbol: equity.symbol,
        name: result.price?.longName ?? equity.name,
        exchange: equity.exchange,
        sector: sp.sector ?? null,
        industry: sp.industry ?? null,
        website: sp.website ?? null,
        country: sp.country ?? null,
        employees: sp.fullTimeEmployees ? Number(sp.fullTimeEmployees) : null,
        description: sp.longBusinessSummary ?? null,
        source: 'yahoo',
      };
    } catch {
      /* fallthrough a fuentes keyless */
    }
  }

  const nameKey = symbolOrName.trim().toLowerCase();
  const results = await tavilySearch(`${symbolOrName} company profile funding valuation business`, 5).catch(() => []);
  const relevant = results.find(
    r => r.title.toLowerCase().includes(nameKey) || r.snippet.toLowerCase().includes(nameKey),
  );
  return {
    symbol: symbolOrName,
    name: symbolOrName,
    exchange: 'privada / no listada',
    sector: null,
    industry: null,
    website: null,
    country: null,
    employees: null,
    description: relevant ? `${relevant.title}: ${relevant.snippet}` : null,
    source: relevant ? 'web' : 'web',
  };
}

export const companyProfileTool = createTool({
  id: 'company-profile',
  description:
    'Perfil de empresa: sector, industria, web, país, empleados y descripción del negocio. Para cotizadas usa Yahoo Finance; para privadas cae a búsqueda web/Wikipedia (análisis solo cualitativo).',
  inputSchema: z.object({
    company: z.string().describe('Nombre de la empresa o símbolo (p. ej. "Apple", "SAN.MC", "Glovo")'),
  }),
  outputSchema: z.object({
    profile: z.object({
      symbol: z.string(),
      name: z.string(),
      exchange: z.string(),
      sector: z.string().nullable(),
      industry: z.string().nullable(),
      website: z.string().nullable(),
      country: z.string().nullable(),
      employees: z.number().nullable(),
      description: z.string().nullable(),
      source: z.string(),
    }),
  }),
  execute: async input => ({ profile: await getProfile(input.company) }),
});
