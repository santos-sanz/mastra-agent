import 'dotenv/config';
import { searchKnowledge } from './mastra/tools/knowledge-search';

const query = process.argv[2] ?? '¿Qué framework usa este proyecto?';
const results = await searchKnowledge(query, 3);

if (results.length === 0) {
  console.log('Sin resultados. Indexa documentos primero: npm run rag:index -- <archivo-o-carpeta>');
} else {
  for (const r of results) {
    console.log(`\n[${r.source}] (score: ${r.score.toFixed(3)})`);
    console.log(r.text.slice(0, 200));
  }
}
