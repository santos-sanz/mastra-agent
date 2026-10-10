import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { z } from 'zod';
import { EMBEDDING_MODEL, nan, nanRerank } from '../nan';
import { vector } from '../storage';

export const KNOWLEDGE_INDEX = 'knowledge';

export async function searchKnowledge(query: string, topK = 5) {
  const { embedding } = await embed({ model: nan.textEmbeddingModel(EMBEDDING_MODEL), value: query });
  const candidates = await vector.query({ indexName: KNOWLEDGE_INDEX, queryVector: embedding, topK: Math.min(topK * 3, 20) });
  if (candidates.length === 0) return [];

  try {
    const ranked = await nanRerank({
      query,
      documents: candidates.map(c => (c.metadata?.text as string) ?? ''),
      topN: topK,
    });
    return ranked.map(r => ({
      text: (candidates[r.index].metadata?.text as string) ?? '',
      source: (candidates[r.index].metadata?.source as string) ?? 'desconocido',
      score: r.score,
    }));
  } catch {
    return candidates.slice(0, topK).map(c => ({
      text: (c.metadata?.text as string) ?? '',
      source: (c.metadata?.source as string) ?? 'desconocido',
      score: c.score,
    }));
  }
}

export const knowledgeSearchTool = createTool({
  id: 'knowledge-search',
  description:
    'Busca en la base de conocimiento local (documentos indexados con npm run rag:index). Devuelve los fragmentos más relevantes con su fuente. Úsala antes de decir que no sabes algo si el usuario pudo haber indexado documentos.',
  inputSchema: z.object({
    query: z.string().describe('Consulta en lenguaje natural'),
    topK: z.number().int().min(1).max(10).default(5).describe('Número de fragmentos a devolver'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        text: z.string(),
        source: z.string(),
        score: z.number(),
      }),
    ),
  }),
  execute: async input => ({ results: await searchKnowledge(input.query, input.topK) }),
});
