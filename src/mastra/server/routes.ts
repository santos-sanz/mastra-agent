import { registerApiRoute } from '@mastra/core/server';
import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';
import { firePlan } from '../tools/fire-plan';

async function runWorkflowJson(
  mastra: Mastra,
  id: string,
  inputData: unknown,
  c: Context,
  opts: { persistSnapshot?: boolean } = {},
) {
  const wf = mastra.getWorkflow(id as never);
  // Plan free de Workers: 50 subrequests/invocación. Sin snapshots intermedios ahorramos
  // escrituras (cada una = 1 subrequest). Los workflows con suspend/resume (company-analysis)
  // necesitan snapshots y no pasan este flag.
  const run = await wf.createRun(
    opts.persistSnapshot === false ? ({ shouldPersistSnapshot: () => false } as never) : undefined,
  );
  try {
    const result = await run.start({ inputData } as never);
    const report = (result as { result?: { report?: string } })?.result?.report;
    return c.json({ runId: run.runId, status: (result as { status?: string }).status, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Too many subrequests')) {
      return c.json(
        {
          error:
            'Este workflow excede el límite de 50 subrequests del plan gratuito de Workers. Usa los endpoints ligeros (fire-plan) o activa Workers Paid.',
        },
        429,
      );
    }
    throw e;
  }
}

export const apiRoutes = [
  registerApiRoute('/custom/health', {
    method: 'GET',
    handler: (c: Context) => c.json({ status: 'ok', agent: 'analyst-agent', model: 'deepseek-v4-flash', gateway: 'nan' }),
  }),

  registerApiRoute('/custom/briefing', {
    method: 'POST',
    openapi: {
      description: 'Genera el briefing diario de mercados (índices, cripto, FX y titulares macro).',
      responses: { 200: { description: 'Briefing en markdown' } },
    },
    createHandler: async ({ mastra }) => async (c: Context) => runWorkflowJson(mastra, 'marketBriefingWorkflow', {}, c),
  }),

  registerApiRoute('/custom/analysis', {
    method: 'POST',
    openapi: {
      description: 'Análisis completo de una empresa (pública o privada). Body: { "company": "Apple" }',
      responses: { 200: { description: 'Informe de análisis en markdown' } },
    },
    createHandler: async ({ mastra }) => async (c: Context) => {
      const body = (await c.req.json().catch(() => ({}))) as { company?: string };
      if (!body.company) return c.json({ error: 'Falta "company" en el body' }, 400);
      return runWorkflowJson(mastra, 'companyAnalysisWorkflow', { company: body.company }, c);
    },
  }),

  registerApiRoute('/custom/compare', {
    method: 'POST',
    openapi: {
      description: 'Compara 2-5 activos tradeables. Body: { "symbols": ["AAPL", "MSFT"] }',
      responses: { 200: { description: 'Comparativa en markdown' } },
    },
    createHandler: async ({ mastra }) => async (c: Context) => {
      const body = (await c.req.json().catch(() => ({}))) as { symbols?: string[] };
      if (!body.symbols || body.symbols.length < 2) return c.json({ error: 'Falta "symbols" (mínimo 2)' }, 400);
      return runWorkflowJson(mastra, 'assetComparisonWorkflow', { symbols: body.symbols.slice(0, 5) }, c, { persistSnapshot: false });
    },
  }),

  registerApiRoute('/custom/portfolio', {
    method: 'POST',
    openapi: {
      description: 'Recomendación educativa de cartera según el perfil del inversor. Body: { "description": "Español de 35 años, 20.000 EUR, horizonte 20 años, riesgo 4" }',
      responses: { 200: { description: 'Informe de cartera + picks estructurados' } },
    },
    createHandler: async ({ mastra }) => async (c: Context) => {
      const body = (await c.req.json().catch(() => ({}))) as { description?: string };
      if (!body.description) return c.json({ error: 'Falta "description" en el body' }, 400);
      return runWorkflowJson(mastra, 'portfolioWorkflow', { description: body.description }, c, { persistSnapshot: false });
    },
  }),

  registerApiRoute('/custom/chat', {
    method: 'POST',
    openapi: {
      description:
        'Chat de una sola pasada con el analista (con tools ligeras). En el plan gratuito de Workers, preguntas con uso intensivo de tools pueden agotar el límite de 50 subrequests.',
      responses: { 200: { description: 'Respuesta del analista' } },
    },
    createHandler: async ({ mastra }) => async (c: Context) => {
      const body = (await c.req.json().catch(() => ({}))) as { message?: string; threadId?: string; resourceId?: string };
      if (!body.message) return c.json({ error: 'Falta "message" en el body' }, 400);
      const agent = mastra.getAgent('analystAgent');
      try {
        const res = await agent.generate(body.message, {
          ...(body.threadId && body.resourceId
            ? { memory: { thread: body.threadId, resource: body.resourceId } }
            : {}),
        });
        return c.json({ text: res.text });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Too many subrequests')) {
          return c.json({ error: 'Límite de subrequests del plan gratuito alcanzado en esta operación. Simplifica la pregunta o usa fire-plan.' }, 429);
        }
        throw e;
      }
    },
  }),

  registerApiRoute('/custom/fire-plan', {
    method: 'POST',
    openapi: {
      description:
        'Calculadora FIRE determinista neta de impuestos: corpus con aportaciones crecientes, drag fiscal de retiradas y posiciones concentradas RSU/options en escenarios. Sin LLM: 0 subrequests, compatible con el plan gratuito de Workers.',
      responses: { 200: { description: 'Plan FIRE con corpus, renta neta y escenarios' } },
    },
    createHandler: async () => async (c: Context) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        currentAge?: number;
        targetAge?: number;
        currentLiquid?: number;
        annualContribution?: number;
        contributionGrowth?: number;
        realReturnPct?: number;
        targetMonthlyIncome?: number;
        savingsTaxPct?: number;
        concentratedPosition?: {
          grossValue: number;
          workIncomeTaxPct?: number;
          appreciationMultiplier?: number;
          liquidationAge?: number;
        };
      };
      if (!body.currentAge || !body.targetAge || body.currentLiquid === undefined || body.annualContribution === undefined || !body.targetMonthlyIncome) {
        return c.json({ error: 'Faltan campos: currentAge, targetAge, currentLiquid, annualContribution, targetMonthlyIncome' }, 400);
      }
      const plan = firePlan({
        currentAge: body.currentAge,
        targetAge: body.targetAge,
        currentLiquid: body.currentLiquid,
        annualContribution: body.annualContribution,
        contributionGrowth: body.contributionGrowth ?? 0,
        realReturnPct: body.realReturnPct ?? 6,
        targetMonthlyIncome: body.targetMonthlyIncome,
        savingsTaxPct: body.savingsTaxPct ?? 21,
        concentratedPosition: body.concentratedPosition ?? null,
      });
      return c.json({ ...plan, disclaimer: 'Información educativa, no asesoramiento financiero personalizado.' });
    },
  }),
];
