import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { storage } from './storage';
import { analystAgent } from './agents/analyst-agent';
import { marketAnalyst } from './agents/market-analyst';
import { macroAnalyst } from './agents/macro-analyst';
import { researcherAgent } from './agents/researcher-agent';
import { extractorAgent } from './agents/extractor-agent';
import { writerAgent } from './agents/writer-agent';
import { companyAnalysisWorkflow } from './workflows/company-analysis';
import { assetComparisonWorkflow } from './workflows/asset-comparison';
import { marketBriefingWorkflow } from './workflows/market-briefing';

export const mastra = new Mastra({
  agents: { analystAgent, marketAnalyst, macroAnalyst, researcherAgent, extractorAgent, writerAgent },
  workflows: { companyAnalysisWorkflow, assetComparisonWorkflow, marketBriefingWorkflow },
  storage,
  logger: new ConsoleLogger({ name: 'mastra-agent', level: 'info' }),
});
