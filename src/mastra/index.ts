import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { storage } from './storage';
import { generalAgent } from './agents/general-agent';
import { researcherAgent } from './agents/researcher-agent';
import { extractorAgent } from './agents/extractor-agent';
import { writerAgent } from './agents/writer-agent';
import { researchWorkflow } from './workflows/research';

export const mastra = new Mastra({
  agents: { generalAgent, researcherAgent, extractorAgent, writerAgent },
  workflows: { researchWorkflow },
  storage,
  logger: new ConsoleLogger({ name: 'mastra-agent', level: 'info' }),
});
