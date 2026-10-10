import 'dotenv/config';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { embed, embedMany } from 'ai';
import { EMBEDDING_MODEL, nan } from './mastra/nan';
import { vector } from './mastra/storage';
import { KNOWLEDGE_INDEX } from './mastra/tools/knowledge-search';

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const EXTENSIONS = new Set(['.md', '.txt', '.ts', '.js', '.json', '.csv']);

async function collectFiles(path: string): Promise<string[]> {
  const s = await stat(path);
  if (s.isFile()) return [path];
  const out: string[] = [];
  for (const entry of await readdir(path, { recursive: true })) {
    const full = join(path, entry);
    const ext = '.' + entry.split('.').pop()!.toLowerCase();
    if ((await stat(full)).isFile() && EXTENSIONS.has(ext)) out.push(full);
  }
  return out;
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    if (i + CHUNK_SIZE >= clean.length) break;
  }
  return chunks;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: npm run rag:index -- <archivo-o-carpeta>');
  process.exit(1);
}

const files = await collectFiles(inputPath);
if (files.length === 0) {
  console.error(`No se encontraron archivos con extensiones válidas en: ${inputPath}`);
  process.exit(1);
}

console.log(`Indexando ${files.length} archivo(s)...`);
const allChunks: { text: string; source: string }[] = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  const chunks = chunkText(content);
  chunks.forEach(text => allChunks.push({ text, source: relative(process.cwd(), file) }));
  console.log(`  ${relative(process.cwd(), file)}: ${chunks.length} fragmento(s)`);
}

console.log(`Generando embeddings para ${allChunks.length} fragmento(s) con ${EMBEDDING_MODEL}...`);
const model = nan.textEmbeddingModel(EMBEDDING_MODEL);
const ids: string[] = [];
const vectors: number[][] = [];
const metadata: Record<string, string>[] = [];
const BATCH = 16;
for (let i = 0; i < allChunks.length; i += BATCH) {
  const batch = allChunks.slice(i, i + BATCH);
  const { embeddings } = await embedMany({ model, values: batch.map(c => c.text) });
  embeddings.forEach((embedding, j) => {
    ids.push(`${i + j}`);
    vectors.push(embedding);
    metadata.push({ text: batch[j].text, source: batch[j].source });
  });
  console.log(`  lote ${Math.floor(i / BATCH) + 1}: ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}`);
}

const indexes = await vector.listIndexes();
if (!indexes.includes(KNOWLEDGE_INDEX)) {
  console.log(`Creando índice "${KNOWLEDGE_INDEX}" (${vectors[0].length} dimensiones)...`);
  await vector.createIndex({ indexName: KNOWLEDGE_INDEX, dimension: vectors[0].length, metric: 'cosine' });
}

await vector.upsert({ indexName: KNOWLEDGE_INDEX, vectors, metadata, ids });
console.log(`✓ ${vectors.length} fragmento(s) indexados en "${KNOWLEDGE_INDEX}".`);
