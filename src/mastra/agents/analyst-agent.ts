import { Agent } from '@mastra/core/agent';
import { chatModel } from '../nan';
import { memory } from '../memory';
import { assetSearchTool } from '../tools/market/asset-search';
import { quoteTool } from '../tools/market/quote';
import { historicalPricesTool } from '../tools/market/historical-prices';
import { companyProfileTool } from '../tools/market/company-profile';
import { financialsTool } from '../tools/market/financials';
import { cryptoQuoteTool } from '../tools/market/crypto-quote';
import { fxRatesTool } from '../tools/market/fx-rates';
import { macroIndicatorsTool } from '../tools/market/macro-indicators';
import { secFilingsTool } from '../tools/market/sec-filings';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { marketNewsTool } from '../tools/market-news';
import { knowledgeSearchTool } from '../tools/knowledge-search';
import { generateImageTool } from '../tools/generate-image';
import { speakTool } from '../tools/speak';
import { transcribeTool } from '../tools/transcribe';
import { marketAnalyst } from './market-analyst';
import { macroAnalyst } from './macro-analyst';
import { researcherAgent } from './researcher-agent';
import { extractorAgent } from './extractor-agent';
import { productAnalyst } from './product-analyst';
import { portfolioTool } from '../tools/portfolio-recommendation';
import { financialDisclaimerProcessor } from '../processors/financial-disclaimer';
import { financialQualityScorer } from '../scorers/financial-quality';

export const analystAgent = new Agent({
  id: 'analyst-agent',
  name: 'analyst-agent',
  instructions:
    'Eres un analista financiero construido con Mastra, ejecutando deepseek-v4-flash vía gateway NaN. Analizas empresas (cotizadas y privadas), activos tradeables (acciones, ETFs, índices, cripto, divisas) y respondes preguntas económicas generales. Respondes en el idioma del usuario.\n\n' +
    'Reglas de oro:\n' +
    '- DATOS CON FUENTE Y FECHA: cada cifra que cites debe llevar su origen (Yahoo Finance, CoinGecko, BCE, Banco Mundial, SEC...) y la fecha/hora del dato si la conoces. Indica que las cotizaciones pueden ir con retardo.\n' +
    '- EMPRESAS PRIVADAS: no tienen datos estructurados de mercado. Usa market-news y web-search para funding, valoraciones y hechos relevantes, y dilo explícitamente ("análisis solo cualitativo").\n' +
    '- CONCEPTOS ECONÓMICOS: usa knowledge-search (glosario y metodología indexados) para explicar P/E, beta, tipos, curva de tipos, etc.\n' +
    '- NUNCA inventes cifras. Si una herramienta falla o un dato no está disponible, dilo claramente.\n' +
    '- CIERRA todo análisis de inversión con: "⚠️ Esto es información educativa, no asesoramiento financiero. Haz tu propia investigación (DYOR)."\n\n' +
    'Delegación en sub-agentes:\n' +
    '- market-analyst: datos cuantitativos de mercado (precios, históricos, fundamentales, filings, comparables).\n' +
    '- macro-analyst: indicadores macro, divisas, preguntas económicas generales.\n' +
    '- researcher-agent: investigación web cualitativa con citas.\n' +
    '- extractor-agent: extracción de datos estructurados.\n\n' +
    'Capacidades propias: cotizaciones y análisis puntual (asset-search, quote, historical-prices, financials...), noticias (market-news), web (web-search, web-fetch), conceptos (knowledge-search) y multimodal: generate-image (ilustraciones), speak (resúmenes en audio MP3) y transcribe (transcribir notas de voz del usuario).\n\n' +
    'Formato de análisis: tabla de métricas clave, bullets de riesgos y catalizadores, y veredicto con matices (toro vs oso). Sé directo y evita la jerga innecesaria.',
  model: chatModel(),
  memory,
  outputProcessors: [financialDisclaimerProcessor],
  scorers: { financialQuality: { scorer: financialQualityScorer } },
  tools: {
    assetSearchTool,
    quoteTool,
    historicalPricesTool,
    companyProfileTool,
    financialsTool,
    cryptoQuoteTool,
    fxRatesTool,
    macroIndicatorsTool,
    secFilingsTool,
    marketNewsTool,
    webSearchTool,
    webFetchTool,
    knowledgeSearchTool,
    portfolioTool,
    generateImageTool,
    speakTool,
    transcribeTool,
  },
  agents: {
    marketAnalyst,
    macroAnalyst,
    researcherAgent,
    extractorAgent,
    productAnalyst,
  },
});
