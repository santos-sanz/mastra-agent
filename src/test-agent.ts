import 'dotenv/config';
import { mastra } from './mastra';

const thread = { thread: `chat-${Date.now()}`, resource: 'user-andres' };
const agent = mastra.getAgent('analystAgent');

console.log('--- Turno 1 ---');
const r1 = await agent.generate(
  'Me llamo Andrés, trabajo en NaN y estoy construyendo un agente con Mastra. ¿Qué herramientas tienes disponibles? Resume en 2 líneas.',
  { memory: thread },
);
console.log(r1.text);

console.log('\n--- Turno 2 (prueba de memoria) ---');
const r2 = await agent.generate('¿Cómo me llamo, a qué me dedico y qué framework estoy usando?', { memory: thread });
console.log(r2.text);
