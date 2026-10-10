import { createTool } from '@mastra/core/tools';
import { readFile } from 'node:fs/promises';
import { nanTranscribe } from '../nan';
import { z } from 'zod';

export async function transcribeAudio(filePath: string, language?: string) {
  const file = await readFile(filePath);
  const result = await nanTranscribe({ file, filename: filePath.split('/').pop(), language });
  return { text: result.text, language: result.language, duration: result.duration };
}

export const transcribeTool = createTool({
  id: 'transcribe',
  description: 'Transcribe un archivo de audio local (mp3, wav, m4a...) a texto con whisper. Devuelve el texto y el idioma detectado.',
  inputSchema: z.object({
    filePath: z.string().describe('Ruta absoluta o relativa al archivo de audio'),
    language: z.string().optional().describe('Código de idioma ISO (p. ej. "es") para forzar el idioma'),
  }),
  outputSchema: z.object({
    text: z.string(),
    language: z.string().optional(),
    duration: z.number().optional(),
  }),
  execute: async input => transcribeAudio(input.filePath, input.language),
});
