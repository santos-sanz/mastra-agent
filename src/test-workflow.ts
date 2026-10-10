import 'dotenv/config';
import { mastra } from './mastra';

const topic = process.argv[2] ?? 'novedades del framework Mastra en 2026';

console.log(`Iniciando workflow de investigación sobre: "${topic}"...`);
const wf = mastra.getWorkflow('researchWorkflow');
const run = await wf.createRun();
const result = await run.start({ inputData: { topic } });
console.log(JSON.stringify(result, null, 2));
