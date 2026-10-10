import { registerApiRoute } from '@mastra/core/server';
import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';

async function runWorkflowJson(mastra: Mastra, id: string, inputData: unknown, c: Context) {
  const wf = mastra.getWorkflow(id as never);
  const run = await wf.createRun();
  const result = await run.start({ inputData } as never);
  const report = (result as { result?: { report?: string } })?.result?.report;
  return c.json({ runId: run.runId, status: (result as { status?: string }).status, report });
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
      return runWorkflowJson(mastra, 'assetComparisonWorkflow', { symbols: body.symbols.slice(0, 5) }, c);
    },
  }),
];
