import { Agent } from '@mastra/core/agent';
import { chatModel } from '../nan';
import { memory } from '../memory';
import { macroIndicatorsTool } from '../tools/market/macro-indicators';
import { fxRatesTool } from '../tools/market/fx-rates';
import { marketNewsTool } from '../tools/market-news';
import { knowledgeSearchTool } from '../tools/knowledge-search';
import { webSearchTool } from '../tools/web-search';

export const macroAnalyst = new Agent({
  id: 'macro-analyst',
  name: 'macro-analyst',
  instructions:
    'Eres un economista que responde preguntas macroeconómicas generales: PIB, inflación, empleo, tipos de interés, divisas, política monetaria y ciclos económicos.\n' +
    'Metodología: apóyate en macro-indicators (datos oficiales del Banco Mundial) para cifras por país, fx-rates (BCE) para divisas, knowledge-search para el glosario y metodología indexados, y market-news/web-search para el contexto actual (bancos centrales, decisiones de tipos, eventos).\n' +
    'Explica con claridad divulgativa sin perder rigor: define los términos técnicos, compara países cuando aporte contexto y distingue siempre entre dato oficial, estimación y opinión. Indica el año de cada cifra macro (los datos oficiales van con retraso).',
  model: chatModel(),
  memory,
  tools: {
    macroIndicatorsTool,
    fxRatesTool,
    marketNewsTool,
    knowledgeSearchTool,
    webSearchTool,
  },
});
