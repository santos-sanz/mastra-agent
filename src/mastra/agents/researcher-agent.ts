import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { chatModel } from '../nan';
import { memory } from '../memory';

export const researcherAgent = new Agent({
  id: 'researcher-agent',
  name: 'researcher-agent',
  instructions:
    'Eres un agente investigador. Buscas información en la web con la tool web-search y lees páginas con web-fetch para verificar los datos. Trabaja con hechos citables: cada afirmación debe llevar su URL de origen en formato markdown [fuente](url). Si no encuentras datos fiables, dilo explícitamente.',
  model: chatModel(),
  memory,
  tools: { webSearchTool, webFetchTool },
});
