import 'dotenv/config';
import { mastra } from './mastra';
import { nan } from './mastra/nan';

const task =
  process.argv.slice(2).join(' ') ||
  'Consulta el precio actual de Bitcoin en USD y explica en una frase qué es el P/E. Sé breve.';

console.log(`🕸️  Red de agentes — tarea: "${task}"\n`);

const agent = mastra.getAgent('analystAgent');
// El router de la red necesita json_schema: usamos qwen3.6 (los especialistas siguen en deepseek)
const stream = await agent.network(task, { model: nan('qwen3.6') });

let text = '';
for await (const chunk of stream as unknown as AsyncIterable<unknown>) {
  const c = chunk as { type?: string; text?: string; payload?: { text?: string } };
  if (typeof c?.text === 'string' && ['text', 'text-delta'].includes(c.type ?? '')) {
    text += c.text;
    process.stdout.write(c.text);
  } else if (c?.type === 'routing-agent-text-delta' && typeof c.payload?.text === 'string') {
    text += c.payload.text;
    process.stdout.write(c.payload.text);
  }
}

if (!text.trim()) {
  console.log('(sin salida de texto — respuesta vacía)');
  process.exit(1);
}
console.log(`\n\n✓ Red completada (${text.length} caracteres).`);
