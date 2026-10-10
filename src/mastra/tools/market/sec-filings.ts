import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const EFTS_UA = 'Mozilla/5.0';
const SEC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const cikCache = new Map<string, number>();

async function tickerToCik(symbol: string): Promise<number> {
  const upper = symbol.toUpperCase();
  if (cikCache.has(upper)) return cikCache.get(upper)!;
  const res = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${upper}"`)}&forms=10-K`, {
    headers: { 'User-Agent': EFTS_UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`SEC EDGAR HTTP ${res.status} al buscar el CIK de ${upper}`);
  const json = (await res.json()) as {
    hits?: { hits?: { _source?: { ciks?: string[]; display_names?: string[] } }[] };
  };
  const hits = json.hits?.hits ?? [];
  for (const h of hits) {
    const ciks = h._source?.ciks ?? [];
    const names = h._source?.display_names ?? [];
    const tickerMatches = names.some(n => n.toUpperCase().includes(`(${upper})`));
    if (ciks[0] && (tickerMatches || hits.length === 1)) {
      const cik = parseInt(ciks[0], 10);
      cikCache.set(upper, cik);
      return cik;
    }
  }
  throw new Error(`"${upper}" no está en el registro de la SEC (solo empresas con filing en EE. UU.)`);
}

export type Filing = {
  form: string;
  filedDate: string;
  reportDate: string | null;
  description: string;
  url: string;
};

export async function getSecFilings(symbol: string, limit = 8): Promise<{ company: string; cik: number; filings: Filing[] }> {
  const cik = await tickerToCik(symbol);
  const padded = String(cik).padStart(10, '0');
  const res = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
    headers: { 'User-Agent': SEC_UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status} para CIK ${padded}`);
  const json = (await res.json()) as {
    name: string;
    filings?: { recent?: { form: string[]; filingDate: string[]; reportDate: (string | null)[]; primaryDocDescription?: string[]; accessionNumber: string[]; primaryDocument: string[] } };
  };

  const recent = json.filings?.recent;
  if (!recent?.form?.length) throw new Error(`SEC sin filings recientes para ${symbol}`);

  const filings: Filing[] = [];
  for (let i = 0; i < recent.form.length && filings.length < limit; i++) {
    if (!/^(10-|8-K|20-F|6-K|S-\d|424B|SC 13|DEF 14A|DEFA14A|11-K|NT )/.test(recent.form[i])) continue;
    const accession = recent.accessionNumber[i].replace(/-/g, '');
    filings.push({
      form: recent.form[i],
      filedDate: recent.filingDate[i],
      reportDate: recent.reportDate?.[i] ?? null,
      description: recent.primaryDocDescription?.[i] ?? recent.primaryDocument?.[i] ?? '',
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${recent.primaryDocument[i]}`,
    });
  }
  return { company: json.name, cik, filings };
}

export const secFilingsTool = createTool({
  id: 'sec-filings',
  description:
    'Últimos filings oficiales relevantes (10-K, 10-Q, 8-K, 20-F...) de una empresa registrada en la SEC de EE. UU., con enlaces a los documentos. Filtra por defecto los Form 4/5 (transacciones de insiders). Solo empresas que reportan en EE. UU.',
  inputSchema: z.object({
    symbol: z.string().describe('Ticker (p. ej. AAPL, MSFT, TSLA)'),
    limit: z.number().int().min(1).max(15).default(8).describe('Número máximo de filings'),
  }),
  outputSchema: z.object({
    company: z.string(),
    cik: z.number(),
    filings: z.array(
      z.object({
        form: z.string(),
        filedDate: z.string(),
        reportDate: z.string().nullable(),
        description: z.string(),
        url: z.string(),
      }),
    ),
  }),
  execute: async input => {
    const { company, cik, filings } = await getSecFilings(input.symbol, input.limit);
    return { company, cik, filings };
  },
});
