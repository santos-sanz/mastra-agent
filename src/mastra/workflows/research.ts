import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { researcherAgent } from '../agents/researcher-agent';
import { writerAgent } from '../agents/writer-agent';
import { searchWeb } from '../tools/web-search';

const queriesSchema = z.object({
  topic: z.string(),
  queries: z.array(z.string()).min(1).max(5),
});

const resultsSchema = z.object({
  topic: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    }),
  ),
});

const reportSchema = z.object({
  report: z.string(),
});

const generateQueries = createStep({
  id: 'generate-queries',
  description: 'El agente investigador genera 3 búsquedas web distintas sobre el tema.',
  inputSchema: z.object({ topic: z.string().describe('Tema a investigar') }),
  outputSchema: queriesSchema,
  execute: async ({ inputData }) => {
    const { topic } = inputData;
    const res = await researcherAgent.generate(
      `Genera exactamente 3 consultas de búsqueda web distintas y complementarias sobre este tema: "${topic}". Devuelve solo las consultas.`,
      { structuredOutput: { schema: z.object({ queries: z.array(z.string()).describe('3 consultas de búsqueda') }), jsonPromptInjection: 'auto' } },
    );
    return { topic, queries: res.object.queries.slice(0, 3) };
  },
});

const search = createStep({
  id: 'search-web',
  description: 'Ejecuta las búsquedas en la web y deduplica resultados por URL.',
  inputSchema: queriesSchema,
  outputSchema: resultsSchema,
  execute: async ({ inputData }) => {
    const { topic, queries } = inputData;
    const seen = new Set<string>();
    const results: z.infer<typeof resultsSchema>['results'] = [];
    for (const query of queries) {
      const { results: found } = await searchWeb(query, 3);
      for (const r of found) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        results.push(r);
      }
    }
    return { topic, results };
  },
});

const synthesize = createStep({
  id: 'synthesize-report',
  description: 'El agente investigador sintetiza un informe con citas a partir de los resultados.',
  inputSchema: resultsSchema,
  outputSchema: reportSchema,
  execute: async ({ inputData }) => {
    const { topic, results } = inputData;
    const sources = results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nResumen: ${r.snippet}`).join('\n\n');
    const res = await writerAgent.generate(
      `Investigación sobre: "${topic}".\n\nFuentes encontradas:\n${sources}\n\n` +
        `Escribe un informe breve en español con: 1) resumen de lo encontrado, 2) puntos clave con citas [n], 3) lista de fuentes con enlaces markdown. ` +
        `Si las fuentes son insuficientes o poco fiables, indícalo claramente.`,
    );
    return { report: res.text };
  },
});

export const researchWorkflow = createWorkflow({
  id: 'research-workflow',
  description: 'Investiga un tema: genera consultas, busca en la web y sintetiza un informe con citas.',
  inputSchema: z.object({ topic: z.string().describe('Tema a investigar') }),
  outputSchema: reportSchema,
})
  .then(generateQueries)
  .then(search)
  .then(synthesize)
  .commit();
