import { Agent } from '@mastra/core/agent';
import { chatModel } from '../nan';

export const extractorAgent = new Agent({
  id: 'extractor-agent',
  name: 'extractor-agent',
  instructions:
    'Eres un agente extractor de datos. Del texto recibido, extrae fielmente los campos del schema que se te pida. No inventes valores: si un dato no aparece, déjalo como null. Responde siempre en el formato estructurado solicitado.',
  model: chatModel(),
});
