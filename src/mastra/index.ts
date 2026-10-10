import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';
import { storage } from './storage';
import { analystAgent } from './agents/analyst-agent';
import { marketAnalyst } from './agents/market-analyst';
import { macroAnalyst } from './agents/macro-analyst';
import { researcherAgent } from './agents/researcher-agent';
import { extractorAgent } from './agents/extractor-agent';
import { writerAgent } from './agents/writer-agent';
import { productAnalyst } from './agents/product-analyst';
import { companyAnalysisWorkflow } from './workflows/company-analysis';
import { assetComparisonWorkflow } from './workflows/asset-comparison';
import { marketBriefingWorkflow } from './workflows/market-briefing';
import { portfolioWorkflow } from './workflows/portfolio';
import { apiRoutes } from './server/routes';

export const mastra = new Mastra({
  agents: { analystAgent, marketAnalyst, macroAnalyst, researcherAgent, extractorAgent, writerAgent, productAnalyst },
  workflows: { companyAnalysisWorkflow, assetComparisonWorkflow, marketBriefingWorkflow, portfolioWorkflow },
  storage,
  server: { apiRoutes },
  deployer: new CloudflareDeployer({
    name: 'mastra-agent',
    compatibility_date: '2026-10-01',
    compatibility_flags: ['nodejs_compat'],
    observability: { enabled: true },
  }),
  logger: new ConsoleLogger({ name: 'mastra-agent', level: 'info' }),
});
