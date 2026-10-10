import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { extractorAgent } from '../agents/extractor-agent';
import { productAnalyst } from '../agents/product-analyst';
import { selectProducts, type InvestorProfile } from '../products/portfolio';

const profileSchema = z.object({
  country: z.string(),
  horizonYears: z.number().int().min(1).max(50),
  riskTolerance: z.number().int().min(1).max(5),
  age: z.number().nullable().optional(),
  capital: z.number().nullable().optional(),
  currency: z.string().optional(),
  objective: z.string().optional(),
  constraints: z.array(z.string()).optional(),
});

const extractProfile = createStep({
  id: 'extract-profile',
  description: 'Extrae y normaliza el perfil del inversor desde su descripción libre (con valores por defecto razonables).',
  inputSchema: z.object({ description: z.string().describe('Descripción libre del inversor: país, edad, capital, horizonte, riesgo, objetivo') }),
  outputSchema: z.object({
    profile: profileSchema,
    assumptions: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const res = await extractorAgent.generate(
      `Extrae el perfil de inversor de este texto y devuélvelo en el schema. Si un dato no aparece, usa: country=null (si no aparece, "ES"), horizonYears=15, riskTolerance=3, age=null, capital=null. Registra cada suposición como string en "assumptions" (array de strings, vacío si todo estaba explícito).\n\nTexto:\n${inputData.description}`,
      {
        structuredOutput: {
          schema: z.object({
            country: z.string(),
            horizonYears: z.number().int().min(1).max(50),
            riskTolerance: z.number().int().min(1).max(5),
            age: z.number().nullable(),
            capital: z.number().nullable(),
            currency: z.string().nullable(),
            objective: z.string().nullable(),
            constraints: z.array(z.string()),
            assumptions: z.array(z.string()),
          }),
          jsonPromptInjection: 'auto',
        },
      },
    );
    const o = res.object;
    return {
      profile: {
        country: o.country,
        horizonYears: o.horizonYears,
        riskTolerance: o.riskTolerance as 1 | 2 | 3 | 4 | 5,
        age: o.age,
        capital: o.capital,
        currency: o.currency ?? undefined,
        objective: o.objective ?? undefined,
        constraints: o.constraints,
      },
      assumptions: o.assumptions,
    };
  },
});

const buildPortfolio = createStep({
  id: 'build-portfolio',
  description: 'Asignación determinista por clases + selección de productos del catálogo por país y fiscalidad.',
  inputSchema: z.object({
    profile: profileSchema,
    assumptions: z.array(z.string()),
  }),
  outputSchema: z.object({
    profile: profileSchema,
    assumptions: z.array(z.string()),
    sleeves: z.array(z.object({ assetClass: z.string(), weightPct: z.number(), rationale: z.string() })),
    picks: z.array(
      z.object({
        sleeve: z.string(),
        weightPct: z.number(),
        product: z.object({
          name: z.string(),
          type: z.string(),
          ticker: z.string().optional(),
          isin: z.string().optional(),
          domicile: z.string(),
          ter: z.number(),
          currency: z.string(),
          note: z.string().optional(),
        }),
        fiscalNote: z.string().nullable(),
      }),
    ),
    warnings: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const { profile, assumptions } = inputData;
    const { allocation, picks, warnings } = selectProducts(profile as InvestorProfile);
    return {
      profile,
      assumptions,
      sleeves: allocation.sleeves,
      picks: picks.map(p => ({
        sleeve: p.sleeve,
        weightPct: p.weightPct,
        product: {
          name: p.product.name,
          type: p.product.type,
          ticker: p.product.ticker,
          isin: p.product.isin,
          domicile: p.product.domicile,
          ter: p.product.ter,
          currency: p.product.currency,
          note: p.product.note,
        },
        fiscalNote: p.fiscalNote,
      })),
      warnings,
    };
  },
});

const writeRecommendation = createStep({
  id: 'write-recommendation',
  description: 'El analista de producto redacta la recomendación: cartera, fiscalidad, accesibilidad y plan.',
  inputSchema: z.object({
    profile: profileSchema,
    assumptions: z.array(z.string()),
    sleeves: z.array(z.object({ assetClass: z.string(), weightPct: z.number(), rationale: z.string() })),
    picks: z.array(
      z.object({
        sleeve: z.string(),
        weightPct: z.number(),
        product: z.object({
          name: z.string(),
          type: z.string(),
          ticker: z.string().optional(),
          isin: z.string().optional(),
          domicile: z.string(),
          ter: z.number(),
          currency: z.string(),
          note: z.string().optional(),
        }),
        fiscalNote: z.string().nullable(),
      }),
    ),
    warnings: z.array(z.string()),
  }),
  outputSchema: z.object({
    report: z.string(),
    portfolio: z.object({
      profile: profileSchema,
      picks: z.array(
        z.object({
          sleeve: z.string(),
          weightPct: z.number(),
          productName: z.string(),
          ticker: z.string().optional(),
          ter: z.number(),
        }),
      ),
    }),
  }),
  execute: async ({ inputData }) => {
    const { profile, assumptions, sleeves, picks, warnings } = inputData;
    const snapshot = JSON.stringify({ profile, assumptions, sleeves, picks, warnings }, null, 2);
    const res = await productAnalyst.generate(
      `Redacta la recomendación de cartera para este caso. Estructura obligatoria:\n` +
        `## Tu perfil (y suposiciones asumidas si las hay)\n## Cartera propuesta (tabla: sleeve, peso, producto, ISIN, TER, domicilio)\n## Por qué esta cartera\n## Fiscalidad en tu país (con las notas del catálogo y el corpus)\n## Accesibilidad: dónde comprarlo (brokers de su país)\n## Plan de aportaciones y rebalanceo\n## Riesgos y qué esperar en una caída\n## Alternativas del catálogo\n## Fuentes\n\n` +
        `Datos estructurados del caso:\n${snapshot}`,
    );
    return {
      report: res.text,
      portfolio: {
        profile,
        picks: picks.map(p => ({ sleeve: p.sleeve, weightPct: p.weightPct, productName: p.product.name, ticker: p.product.ticker, ter: p.product.ter })),
      },
    };
  },
});

export const portfolioWorkflow = createWorkflow({
  id: 'portfolio-workflow',
  description: 'Recomendación educativa de cartera: perfil del inversor → asignación determinista → productos accesibles y fiscalmente eficientes → informe.',
  inputSchema: z.object({ description: z.string().describe('Descripción libre del inversor') }),
  outputSchema: z.object({
    report: z.string(),
    portfolio: z.object({
      profile: profileSchema,
      picks: z.array(
        z.object({
          sleeve: z.string(),
          weightPct: z.number(),
          productName: z.string(),
          ticker: z.string().optional(),
          ter: z.number(),
        }),
      ),
    }),
  }),
})
  .then(extractProfile)
  .then(buildPortfolio)
  .then(writeRecommendation)
  .commit();
