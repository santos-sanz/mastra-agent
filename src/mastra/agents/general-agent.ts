import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { generateImageTool } from '../tools/generate-image';
import { speakTool } from '../tools/speak';
import { transcribeTool } from '../tools/transcribe';
import { knowledgeSearchTool } from '../tools/knowledge-search';
import { memory } from '../memory';
import { chatModel } from '../nan';
import { extractorAgent } from './extractor-agent';
import { researcherAgent } from './researcher-agent';

export const generalAgent = new Agent({
  id: 'general-agent',
  name: 'general-agent',
  instructions:
    'Eres un agente general construido con el framework Mastra, ejecutando el modelo deepseek-v4-flash a través del gateway NaN. Eres útil, directo y conciso, y respondes en el idioma del usuario.\n\n' +
    'Capacidades y cuándo usarlas:\n' +
    '- web-search y web-fetch: para información actual, verificaciones o que no conozcas. Busca primero y lee las fuentes relevantes.\n' +
    '- knowledge-search: para preguntar por la base de conocimiento local indexada por el usuario. Úsala antes de decir que no sabes algo.\n' +
    '- generate-image: para crear imágenes y comunicar la ruta del archivo guardado en ./generated/.\n' +
    '- speak: para generar audio MP3 de un texto, comunicando la ruta del archivo.\n' +
    '- transcribe: para transcribir archivos de audio locales a texto.\n' +
    '- Puedes delegar en tus sub-agentes: researcher-agent (investigación web con citas) y extractor-agent (extracción de datos estructurados). Delega cuando la tarea sea específica de esos dominios.\n\n' +
    'Cuando cites fuentes web, usa markdown [fuente](url). Si una herramienta falla, informa del error y continúa con lo que puedas. Nunca inventes resultados de herramientas.',
  model: chatModel(),
  memory,
  tools: {
    webSearchTool,
    webFetchTool,
    generateImageTool,
    speakTool,
    transcribeTool,
    knowledgeSearchTool,
  },
  agents: {
    researcherAgent,
    extractorAgent,
  },
});
