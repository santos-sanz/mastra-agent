import { createTool } from '@mastra/core/tools';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanSpeech } from '../nan';
import { z } from 'zod';

export async function speak(text: string, voice = 'af_heart') {
  const audio = await nanSpeech({ input: text.slice(0, 1000), voice });
  const dir = join(process.cwd(), 'generated');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `tts-${Date.now()}.mp3`);
  await writeFile(path, audio);
  return { path };
}

export const speakTool = createTool({
  id: 'speak',
  description: 'Convierte texto en audio MP3 con síntesis de voz (kokoro) y lo guarda en ./generated/. Devuelve la ruta local.',
  inputSchema: z.object({
    text: z.string().describe('Texto a convertir en voz (máx. ~1000 caracteres)'),
    voice: z.string().default('af_heart').describe('Voz de kokoro (p. ej. af_heart, am_michael, bf_emma)'),
  }),
  outputSchema: z.object({
    path: z.string(),
  }),
  execute: async input => speak(input.text, input.voice),
});
