import 'dotenv/config';
import { mastra } from './mastra';

const [, , command, ...args] = process.argv;

const help = () => {
  console.log(`Uso: npm run workflow -- <comando> [args]

  analysis  <empresa-o-ticker>   Análisis completo de una empresa (p. ej. analysis "Apple")
  compare   <SYM1 SYM2 ...>      Compara 2-5 activos (p. ej. compare AAPL MSFT)
  briefing                       Snapshot diario de mercados`);
  process.exit(1);
};

type WorkflowId = 'companyAnalysisWorkflow' | 'assetComparisonWorkflow' | 'marketBriefingWorkflow';

async function runWorkflow(id: WorkflowId, inputData: unknown): Promise<string> {
  const wf = mastra.getWorkflow(id);
  const run = await wf.createRun();
  const result = await run.start({ inputData } as never);
  return (result as { result?: { report?: string } })?.result?.report ?? JSON.stringify(result, null, 2);
}

if (command === 'analysis') {
  const company = args.join(' ') || 'Apple';
  console.log(`📊 Analizando ${company}...`);
  console.log(await runWorkflow('companyAnalysisWorkflow', { company }));
} else if (command === 'compare') {
  const symbols = args.length >= 2 ? args : ['AAPL', 'MSFT'];
  console.log(`⚖️ Comparando: ${symbols.join(' vs ')}`);
  console.log(await runWorkflow('assetComparisonWorkflow', { symbols }));
} else if (command === 'briefing') {
  console.log('📰 Generando briefing de mercados...');
  console.log(await runWorkflow('marketBriefingWorkflow', {}));
} else {
  help();
}
