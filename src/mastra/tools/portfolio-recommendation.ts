import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { selectProducts } from '../products/portfolio';

const profileSchema = z.object({
  country: z.string().describe('País de residencia fiscal del inversor (p. ej. "ES", "MX", "DE")'),
  horizonYears: z.number().int().min(1).max(50).describe('Horizonte de inversión en años'),
  riskTolerance: z.number().int().min(1).max(5).describe('Tolerancia al riesgo 1 (conservador) a 5 (agresivo)'),
  age: z.number().int().min(18).max(100).optional().describe('Edad si se conoce'),
  capital: z.number().min(0).optional().describe('Capital inicial aproximado'),
  currency: z.string().optional().describe('Divisa preferida (EUR, USD, MXN...)'),
  objective: z.string().optional().describe('Objetivo (jubilación, vivienda, libertad financiera...)'),
  constraints: z.array(z.string()).optional().describe('Restricciones (liquidez, criterios éticos, divisa...)'),
});

export const portfolioTool = createTool({
  id: 'portfolio-recommendation',
  description:
    'Genera una propuesta de cartera educativa: a partir del perfil del inversor (país, horizonte, riesgo 1-5), produce la asignación por clases (reglas deterministas) y los productos concretos del catálogo filtrados por accesibilidad del país y preferencia fiscal (fondos traspasables en España, UCITS en UE...). Devuelve sleeves, pesos, productos con ISIN/TER y notas fiscales.',
  inputSchema: profileSchema,
  outputSchema: z.object({
    sleeves: z.array(
      z.object({
        assetClass: z.string(),
        weightPct: z.number(),
        rationale: z.string(),
      }),
    ),
    picks: z.array(
      z.object({
        assetClass: z.string(),
        weightPct: z.number(),
        productName: z.string(),
        productType: z.string(),
        ticker: z.string().optional(),
        isin: z.string().optional(),
        domicile: z.string(),
        ter: z.number(),
        fiscalNote: z.string().nullable(),
      }),
    ),
    warnings: z.array(z.string()),
  }),
  execute: async input => {
    const { profile, allocation, picks, warnings } = selectProducts({
      country: input.country,
      horizonYears: input.horizonYears,
      riskTolerance: input.riskTolerance as 1 | 2 | 3 | 4 | 5,
      age: input.age ?? null,
      capital: input.capital ?? null,
      currency: input.currency,
      objective: input.objective,
      constraints: input.constraints,
      experience: null,
    });
    return {
      sleeves: allocation.sleeves.map(s => ({ assetClass: s.assetClass, weightPct: s.weightPct, rationale: s.rationale })),
      picks: picks.map(p => ({
        assetClass: p.sleeve,
        weightPct: p.weightPct,
        productName: p.product.name,
        productType: p.product.type,
        ticker: p.product.ticker,
        isin: p.product.isin,
        domicile: p.product.domicile,
        ter: p.product.ter,
        fiscalNote: p.fiscalNote,
      })),
      warnings,
    };
  },
});
