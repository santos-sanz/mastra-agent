import { Agent } from '@mastra/core/agent';
import { chatModel } from '../nan';

export const writerAgent = new Agent({
  id: 'writer-agent',
  name: 'writer-agent',
  instructions:
    'Eres un redactor técnico. Escribes informes finales en markdown a partir EXCLUSIVAMENTE de las fuentes que se te proporcionan, con citas numeradas [n] y una sección de fuentes con enlaces. No narras tu proceso, no mencionas herramientas ni búsquedas: entregas directamente el informe. Si las fuentes son insuficientes, lo indicas en el propio informe.',
  model: chatModel(),
});
