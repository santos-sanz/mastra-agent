import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { marketAnalyst } from '../agents/market-analyst';
import { researcherAgent } from '../agents/researcher-agent';
import { writerAgent } from '../agents/writer-agent';
import { getQuote } from '../tools/market/quote';
import { getFinancials } from '../tools/market/financials';
import { searchAsset } from '../tools/market/asset-search';
import { getProfile } from '../tools/market/company-profile';
import { marketNews } from '../tools/market-news';

const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  exchange: z.string(),
  changePercent: z.number(),
  fiftyTwoWeekLow: z.number().nullable(),
  fiftyTwoWeekHigh: z.number().nullable(),
  marketTime: z.string(),
});

const financialsSchema = z.object({
  symbol: z.string(),
  currency: z.string(),
  marketCap: z.number().nullable(),
  trailingPE: z.number().nullable(),
  forwardPE: z.number().nullable(),
  beta: z.number().nullable(),
  profitMarginPct: z.number().nullable(),
  returnOnEquityPct: z.number().nullable(),
  revenueGrowthPct: z.number().nullable(),
  debtToEquity: z.number().nullable(),
  targetMeanPrice: z.number().nullable(),
  recommendation: z.string().nullable(),
});

const resolveSymbol = createStep({
  id: 'resolve-symbol',
  description: 'Resuelve el nombre/ ticker de la empresa a un símbolo de Yahoo Finance.',
  inputSchema: z.object({ company: z.string().describe('Nombre de empresa o ticker') }),
  outputSchema: z.object({ company: z.string(), symbol: z.string().nullable() }),
  execute: async ({ inputData }) => {
    const { company } = inputData;
    try {
      const hits = await searchAsset(company, 3);
      const equity = hits.find(h => h.type === 'EQUITY') ?? hits[0] ?? null;
      return { company, symbol: equity?.symbol ?? null };
    } catch {
      return { company, symbol: null };
    }
  },
});

const gatherData = createStep({
  id: 'gather-data',
  description: 'Recopila quote, perfil, fundamentales y noticias (privadas: solo cualitativo).',
  inputSchema: z.object({ company: z.string(), symbol: z.string().nullable() }),
  outputSchema: z.object({
    company: z.string(),
    symbol: z.string().nullable(),
    quote: quoteSchema.nullable(),
    profile: z.string().nullable(),
    financials: financialsSchema.nullable(),
    news: z.array(z.object({ title: z.string(), url: z.string(), source: z.string(), date: z.string().nullable() })),
  }),
  execute: async ({ inputData }) => {
    const { company, symbol } = inputData;
    const [quote, profileResult, financials, news] = await Promise.all([
      symbol ? getQuote(symbol).catch(() => null) : Promise.resolve(null),
      getProfile(company).catch(() => null),
      symbol ? getFinancials(symbol).catch(() => null) : Promise.resolve(null),
      marketNews(company, 5).catch(() => []),
    ]);
    const profile = profileResult
      ? `${profileResult.name} (${profileResult.exchange}) — sector: ${profileResult.sector ?? 'n/d'}, industria: ${profileResult.industry ?? 'n/d'}, país: ${profileResult.country ?? 'n/d'}, empleados: ${profileResult.employees ?? 'n/d'}. ${profileResult.description ?? ''}`
      : null;
    return { company, symbol, quote, profile, financials, news };
  },
});

const reviewGate = createStep({
  id: 'review-gate',
  description: 'Punto de control humano: suspende con el resumen de datos e investigación hasta recibir aprobación.',
  inputSchema: z.object({
    company: z.string(),
    marketData: z.string(),
    research: z.string(),
  }),
  outputSchema: z.object({
    company: z.string(),
    marketData: z.string(),
    research: z.string(),
    approved: z.boolean(),
  }),
  suspendSchema: z.object({
    company: z.string(),
    summary: z.string().describe('Resumen de los datos recopilados para la revisión'),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    feedback: z.string().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const approved = resumeData?.approved === true;
    if (!approved) {
      await suspend({
        company: inputData.company,
        summary: inputData.marketData.slice(0, 400),
      });
    }
    return { company: inputData.company, marketData: inputData.marketData, research: inputData.research, approved };
  },
});

const gatherQualitative = createStep({
  id: 'gather-qualitative',
  description: 'El researcher profundiza cualitativamente (tesis de inversión, riesgos) con citas.',
  inputSchema: z.object({
    company: z.string(),
    symbol: z.string().nullable(),
    quote: quoteSchema.nullable(),
    profile: z.string().nullable(),
    financials: financialsSchema.nullable(),
    news: z.array(z.object({ title: z.string(), url: z.string(), source: z.string(), date: z.string().nullable() })),
  }),
  outputSchema: z.object({
    company: z.string(),
    marketData: z.string(),
    research: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { company, symbol, quote, profile, financials, news } = inputData;
    const marketData = [
      quote ? `Precio: ${quote.price} ${quote.currency} (${quote.changePercent.toFixed(2)}% hoy) — ${quote.exchange}, dato: ${quote.marketTime}. Rango 52s: ${quote.fiftyTwoWeekLow ?? '?'}–${quote.fiftyTwoWeekHigh ?? '?'}.` : 'Sin cotización disponible (¿privada?).',
      profile ? `Perfil: ${profile}` : '',
      financials ? `Fundamentales: cap. ${financials.marketCap ?? 'n/d'} ${financials.currency}, P/E ${financials.trailingPE ?? 'n/d'}, márgen neto ${financials.profitMarginPct?.toFixed(1) ?? 'n/d'}%, ROE ${financials.returnOnEquityPct?.toFixed(1) ?? 'n/d'}%, deuda/EBITDA n/d, recom. analistas: ${financials.recommendation ?? 'n/d'} (target medio ${financials.targetMeanPrice ?? 'n/d'}).` : 'Sin fundamentales estructurados.',
      news.length ? `Noticias recientes:\n${news.map(n => `- (${n.date ?? 'sin fecha'}) ${n.title} [${n.source}] ${n.url}`).join('\n')}` : 'Sin noticias relevantes encontradas.',
    ].filter(Boolean).join('\n\n');

    const res = await researcherAgent.generate(
      `Empresa a analizar: ${company} (símbolo: ${symbol ?? 'no cotizada'}).\n\nDatos estructurados disponibles:\n${marketData}\n\n` +
        `Complementa con investigación cualitativa: modelo de negocio, posición competitiva, riesgos concretos (regulatorios, competitivos, de balance) y catalizadores próximos. Cita las URLs que uses.`,
    );
    return { company, marketData, research: res.text };
  },
});

const writeReport = createStep({
  id: 'write-report',
  description: 'El writer redacta el informe final con rating, riesgos, catalizadores y disclaimer (si el revisor aprobó).',
  inputSchema: z.object({
    company: z.string(),
    marketData: z.string(),
    research: z.string(),
    approved: z.boolean(),
  }),
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { company, marketData, research, approved } = inputData;
    if (!approved) {
      return { report: `⏸️ El análisis de ${company} quedó archivado: el revisor no aprobó la generación del informe final.` };
    }
    const res = await writerAgent.generate(
      `Escribe un informe de análisis de la empresa ${company} en markdown con esta estructura:\n` +
        `## Resumen ejecutivo\n## Datos de mercado y fundamentales (con fuente y fecha; si algún dato falta, dilo)\n## Tesis toro / tesis oso\n## Riesgos principales\n## Catalizadores a vigilar\n## Veredicto (con matices, no recomendación de compra/venta)\n## Fuentes\n\n` +
        `Cierra SIEMPRE con: "⚠️ Esto es información educativa, no asesoramiento financiero. Haz tu propia investigación (DYOR)."\n\n` +
        `Datos de mercado:\n${marketData}\n\nInvestigación cualitativa (con citas):\n${research}`,
    );
    return { report: res.text };
  },
});

export const companyAnalysisWorkflow = createWorkflow({
  id: 'company-analysis-workflow',
  description: 'Análisis completo de una empresa (pública o privada): datos de mercado, fundamentales, noticias e informe final con disclaimer.',
  inputSchema: z.object({ company: z.string().describe('Nombre de la empresa o ticker') }),
  outputSchema: z.object({ report: z.string() }),
})
  .then(resolveSymbol)
  .then(gatherData)
  .then(gatherQualitative)
  .then(reviewGate)
  .then(writeReport)
  .commit();
