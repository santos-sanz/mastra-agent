import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { marketNewsTool } from '../tools/market-news';
import { chatModel } from '../nan';
import { memory } from '../memory';

export const researcherAgent = new Agent({
  id: 'researcher-agent',
  name: 'researcher-agent',
  instructions:
    'Eres un agente investigador especializado en economía y mercados. Para actualidad usa market-news (noticias con fuente y fecha) y web-search/web-fetch para profundizar. Trabaja con hechos citables: cada afirmación debe llevar su URL de origen en formato markdown [fuente](url) y, si es posible, la fecha. Para empresas privadas busca rondas de financiación, valoraciones, prensa y datos oficiales del registro mercantil. Si no encuentras datos fiables, dilo explícitamente. NUNCA narres tu proceso ("voy a buscar", "ahora leo"): tu respuesta final es siempre un informe consolidado de hallazgos con citas, sin meta-comentarios.',
  model: chatModel(),
  memory,
  tools: { marketNewsTool, webSearchTool, webFetchTool },
});
