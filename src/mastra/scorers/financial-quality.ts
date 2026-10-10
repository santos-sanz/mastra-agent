import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { chatModel } from '../nan';

function toText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'text' in v && typeof (v as { text?: unknown }).text === 'string') {
    return (v as { text: string }).text;
  }
  return JSON.stringify(v);
}

export const financialQualityScorer = createScorer({
  id: 'financial-answer-quality',
  description:
    'Evalúa respuestas del analista financiero: disclaimer presente, fuentes citadas y ausencia de cifras inventadas.',
  type: 'agent',
  judge: {
    model: chatModel(),
    instructions:
      'Eres un auditor estricto de un agente de análisis financiero. Evalúas sus respuestas con criterio: nada de elogios vacíos.',
  },
})
  .analyze({
    description: 'Audita la respuesta: disclaimer, fuentes y solidez',
    outputSchema: z.object({
      hasDisclaimer: z.boolean().describe('Aclara que es información educativa / no asesoramiento (DYOR)'),
      citesSources: z.boolean().describe('Cita fuentes u orígenes de los datos (Yahoo, BCE, SEC, CoinGecko...)'),
      seemsGrounded: z.boolean().describe('Las cifras y afirmaciones parecen fundamentadas, no inventadas'),
    }),
    createPrompt: ({ run }) =>
      `Evalúa esta respuesta de un agente de análisis financiero. Responde solo con el JSON.

PREGUNTA / CONTEXTO:
${toText(run.input)}

RESPUESTA:
${toText(run.output)}

Criterios:
- hasDisclaimer: menciona que es información educativa, no asesoramiento financiero, o DYOR.
- citesSources: referencia el origen de los datos (Yahoo Finance, CoinGecko, BCE, Banco Mundial, SEC, prensa...).
- seemsGrounded: las cifras/afirmaciones tienen estructura de dato real (con fecha, moneda, unidad), no parecen inventadas.`,
  })
  .generateScore(({ results }) => {
    const r = results.analyzeStepResult;
    return (r.hasDisclaimer ? 0.4 : 0) + (r.citesSources ? 0.3 : 0) + (r.seemsGrounded ? 0.3 : 0);
  });
