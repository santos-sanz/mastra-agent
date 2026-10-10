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
import { secFilingsTool } from '../tools/market/sec-filings';

export const marketAnalyst = new Agent({
  id: 'market-analyst',
  name: 'market-analyst',
  instructions:
    'Eres un analista cuantitativo de mercados. Trabajas con datos estructurados: cotizaciones, series históricas, fundamentales, cripto, divisas y filings de la SEC.\n' +
    'Metodología: resuelve primero el símbolo con asset-search si hace falta; usa quote para precio puntual, historical-prices para tendencias y volatilidad, financials para valuación y salud financiera, sec-filings para hechos oficiales reportados.\n' +
    'Interpreta los números, no los lists a secas: compara contra su rango 52 semanas, comenta márgenes y crecimiento en contexto, y señala si un dato viene vacío o incompleto en la fuente. Cita siempre la fuente (Yahoo Finance, CoinGecko, BCE, SEC) y el momento del dato.',
  model: chatModel(),
  memory,
  tools: {
    assetSearchTool,
    quoteTool,
    historicalPricesTool,
    companyProfileTool,
    financialsTool,
    cryptoQuoteTool,
    fxRatesTool,
    secFilingsTool,
  },
});
