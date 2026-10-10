import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { embedMany } from 'ai';
import { z } from 'zod';
import { mastra } from '../mastra';
import { EMBEDDING_MODEL, nan } from '../mastra/nan';
import { vector } from '../mastra/storage';
import { KNOWLEDGE_INDEX, searchKnowledge } from '../mastra/tools/knowledge-search';
import { searchWeb } from '../mastra/tools/web-search';
import { fetchUrl } from '../mastra/tools/web-fetch';
import { generateImage } from '../mastra/tools/generate-image';
import { speak } from '../mastra/tools/speak';
import { transcribeAudio } from '../mastra/tools/transcribe';

export type Artifact = { type: 'image' | 'audio'; path: string };

export type TestCase = {
  id: string;
  category: string;
  name: string;
  useCase: string;
  fn: () => Promise<{ details: string; artifacts?: Artifact[] }>;
};

export type TestResult = TestCase & {
  status: 'pass' | 'fail';
  durationMs: number;
  details: string;
  artifacts?: Artifact[];
  error?: string;
};

const chatModelStamp = EMBEDDING_MODEL;

async function indexDemoDocs(): Promise<number> {
  const files = ['docs/demo/producto.md', 'docs/demo/soporte.md', 'docs/demo/onboarding.md'];
  const chunks: { text: string; source: string }[] = [];
  for (const f of files) {
    const content = await readFile(join(process.cwd(), f), 'utf8');
    chunks.push({ text: content.slice(0, 1200), source: f });
  }
  const { embeddings } = await embedMany({ model: nan.textEmbeddingModel(EMBEDDING_MODEL), values: chunks.map(c => c.text) });
  const indexes = await vector.listIndexes();
  if (!indexes.includes(KNOWLEDGE_INDEX)) {
    await vector.createIndex({ indexName: KNOWLEDGE_INDEX, dimension: embeddings[0].length, metric: 'cosine' });
  }
  await vector.upsert({
    indexName: KNOWLEDGE_INDEX,
    vectors: embeddings,
    metadata: chunks.map(c => ({ text: c.text, source: c.source })),
    ids: chunks.map((_, i) => `doc-${i}`),
  });
  return chunks.length;
}

async function fileExists(path: string): Promise<{ exists: boolean; bytes: number }> {
  try {
    const s = await stat(path);
    return { exists: s.isFile(), bytes: s.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const suite: TestCase[] = [
  {
    id: 'chat-basico',
    category: 'Chat y memoria',
    name: 'Respuesta conversacional básica',
    useCase: 'El usuario chatea con el agente general y recibe una respuesta coherente en su idioma.',
    fn: async () => {
      const agent = mastra.getAgent('generalAgent');
      const res = await agent.generate('¿Qué puedes hacer? Responde en máximo 2 frases.');
      if (res.text.trim().length < 10) throw new Error('Respuesta demasiado corta');
      return { details: res.text };
    },
  },
  {
    id: 'memoria-multiturno',
    category: 'Chat y memoria',
    name: 'Recuerdo dentro de la misma conversación',
    useCase: 'El agente recuerda información dada en un turno anterior del mismo thread (lastMessages).',
    fn: async () => {
      const agent = mastra.getAgent('generalAgent');
      const thread = { thread: `t-${Date.now()}`, resource: 'test-user' };
      await agent.generate('Memoriza esto: el nombre clave de mi proyecto es "Proyecto Fénix". Solo confirma con OK.', { memory: thread });
      const res = await agent.generate('¿Cuál es el nombre clave de mi proyecto?', { memory: thread });
      if (!normalize(res.text).includes('fenix')) throw new Error(`No recordó el dato. Respuesta: ${res.text}`);
      return { details: res.text };
    },
  },
  {
    id: 'working-memory',
    category: 'Chat y memoria',
    name: 'Memoria entre conversaciones distintas',
    useCase: 'El usuario cuenta algo en una sesión y el agente lo recuerda en una sesión nueva (working memory por recurso).',
    fn: async () => {
      const agent = mastra.getAgent('generalAgent');
      const resource = `user-${Date.now()}`;
      await agent.generate('Guarda en tu memoria que trabajo en el equipo de plataforma de NaN y que mi herramienta favorita es tmux.', {
        memory: { thread: `w1-${Date.now()}`, resource },
      });
      const res = await agent.generate('¿En qué equipo trabajo y cuál es mi herramienta favorita?', {
        memory: { thread: `w2-${Date.now()}`, resource },
      });
      const ok = normalize(res.text).includes('plataforma') || normalize(res.text).includes('tmux');
      if (!ok) throw new Error(`No recordó entre sesiones. Respuesta: ${res.text}`);
      return { details: res.text };
    },
  },
  {
    id: 'web-search',
    category: 'Herramientas web',
    name: 'Búsqueda web con resultados reales',
    useCase: 'El agente busca información actual en la web y obtiene URLs y snippets reales.',
    fn: async () => {
      const { results } = await searchWeb('mastra framework TypeScript agentes', 5);
      if (results.length === 0) throw new Error('Búsqueda sin resultados');
      return { details: results.map(r => `- ${r.title} → ${r.url}`).join('\n') };
    },
  },
  {
    id: 'web-fetch',
    category: 'Herramientas web',
    name: 'Lectura y extracción de una página',
    useCase: 'Dada una URL, el agente extrae el texto plano de la página para razonar sobre él.',
    fn: async () => {
      const page = await fetchUrl('https://mastra.ai', 4000);
      if (page.text.length < 300) throw new Error(`Texto extraído insuficiente (${page.text.length} chars)`);
      return { details: `Título: ${page.title}\nCaracteres extraídos: ${page.text.length}\n\n${page.text.slice(0, 400)}...` };
    },
  },
  {
    id: 'rag-indexado',
    category: 'RAG (base de conocimiento)',
    name: 'Indexación de documentos locales',
    useCase: 'Indexar la carpeta docs/ con embeddings del gateway (qwen3-embedding) en LibSQLVector.',
    fn: async () => {
      const n = await indexDemoDocs();
      return { details: `${n} documento(s) indexados en el índice "${KNOWLEDGE_INDEX}" (${chatModelStamp}, 4096 dims).` };
    },
  },
  {
    id: 'rag-precios',
    category: 'RAG (base de conocimiento)',
    name: 'Consulta semántica: precios',
    useCase: 'El usuario pregunta por precios y el agente recupera el documento correcto con rerank.',
    fn: async () => {
      const results = await searchKnowledge('¿Cuánto cuesta el plan Pro de AcmeCloud?', 3);
      if (results.length === 0) throw new Error('Sin resultados');
      const hit = results.find(r => r.source.includes('producto') && normalize(r.text).includes('29'));
      if (!hit) throw new Error(`El documento de precios no aparece en el top-3: ${results.map(r => r.source).join(', ')}`);
      return { details: results.map(r => `[${r.source}] score ${r.score.toFixed(3)}: ${r.text.slice(0, 80)}...`).join('\n') };
    },
  },
  {
    id: 'rag-sla',
    category: 'RAG (base de conocimiento)',
    name: 'Consulta semántica: SLA',
    useCase: 'Pregunta sobre el SLA del plan Enterprise y recuperación del fragmento exacto.',
    fn: async () => {
      const results = await searchKnowledge('¿Qué disponibilidad garantiza el plan Enterprise?', 3);
      if (results.length === 0) throw new Error('Sin resultados');
      const hit = results.find(r => r.text.includes('99,99'));
      if (!hit) throw new Error(`Ningún fragmento contiene el SLA. Top: ${results[0].source}`);
      return { details: `Fuente: ${hit.source} (score ${hit.score.toFixed(3)})\nFragmento: ...${hit.text.slice(hit.text.indexOf('99,99') - 80, hit.text.indexOf('99,99') + 80)}...` };
    },
  },
  {
    id: 'rag-herramientas',
    category: 'RAG (base de conocimiento)',
    name: 'Consulta semántica: stack de la empresa',
    useCase: 'Pregunta por las herramientas que usa la empresa; el RAG debe encontrarlas en el documento de onboarding.',
    fn: async () => {
      const results = await searchKnowledge('¿Qué framework de agentes usa la empresa?', 3);
      const hit = results.find(r => normalize(r.text).includes('mastra'));
      if (!hit) throw new Error(`No se recuperó el fragmento con Mastra. Fuentes: ${results.map(r => r.source).join(', ')}`);
      return { details: `Fuente: ${hit.source} (score ${hit.score.toFixed(3)})\nFragmento: ${hit.text.slice(0, 250)}...` };
    },
  },
  {
    id: 'imagen-generada',
    category: 'Multimodal',
    name: 'Generación de imagen',
    useCase: 'El agente crea una imagen a partir de un prompt (qwen-image-2.1) y la guarda en disco.',
    fn: async () => {
      const img = await generateImage('minimal flat vector icon of a robot head, blue and white palette, white background', '512x512');
      const { exists, bytes } = await fileExists(img.path);
      if (!exists || bytes < 5000) throw new Error(`Archivo inválido: exists=${exists}, ${bytes} bytes`);
      return { details: `Imagen guardada en ${img.path} (${(bytes / 1024).toFixed(1)} KB)`, artifacts: [{ type: 'image', path: img.path }] };
    },
  },
  {
    id: 'voz-transcripcion',
    category: 'Multimodal',
    name: 'Voz sintetizada y transcrita',
    useCase: 'Texto → audio MP3 (kokoro) → transcripción con whisper; el ciclo multimodal completo.',
    fn: async () => {
      const texto = 'La prueba intensiva del agente ha finalizado con éxito.';
      const { path } = await speak(texto, 'af_heart');
      const { exists, bytes } = await fileExists(path);
      if (!exists || bytes < 3000) throw new Error(`Audio inválido: ${bytes} bytes`);
      const t = await transcribeAudio(path, 'es');
      const ok = normalize(t.text).includes('prueba') && normalize(t.text).includes('intensiva');
      if (!ok) throw new Error(`Transcripción no coincide: "${t.text}"`);
      return { details: `Audio: ${path} (${(bytes / 1024).toFixed(1)} KB)\nTranscripción: "${t.text}" (${t.language}, ${t.duration?.toFixed(1)}s)`, artifacts: [{ type: 'audio', path }] };
    },
  },
  {
    id: 'extraccion-estructurada',
    category: 'Agentes estructurados',
    name: 'Extracción de datos con schema Zod',
    useCase: 'De un email en texto libre, el agente extrae campos estructurados y validados (jsonPromptInjection por compatibilidad del modelo).',
    fn: async () => {
      const agent = mastra.getAgent('extractorAgent');
      const schema = z.object({
        nombre: z.string().nullable(),
        empresa: z.string().nullable(),
        email: z.string().nullable(),
        anio_inicio: z.number().nullable(),
      });
      const res = await agent.generate(
        'Hola, soy Marta Ruiz, ingeniera en Acme Corp desde marzo de 2024. Mi correo es marta.ruiz@acme.com.',
        { structuredOutput: { schema, jsonPromptInjection: 'auto' } },
      );
      const o = res.object;
      if (o.nombre !== 'Marta Ruiz' || o.email !== 'marta.ruiz@acme.com' || o.anio_inicio !== 2024) {
        throw new Error(`Extracción incorrecta: ${JSON.stringify(o)}`);
      }
      return { details: JSON.stringify(o, null, 2) };
    },
  },
  {
    id: 'subagente-delegado',
    category: 'Agentes estructurados',
    name: 'Delegación en sub-agente investigador',
    useCase: 'El agente general delega la tarea de investigación en su sub-agente especialista y devuelve el dato con fuente.',
    fn: async () => {
      const agent = mastra.getAgent('generalAgent');
      const thread = { thread: `d-${Date.now()}`, resource: 'test-user' };
      const res = await agent.generate(
        'Delega esta tarea en tu sub-agente investigador: encuentra el repositorio oficial de GitHub del framework Mastra. Devuélveme solo la URL del repositorio.',
        { memory: thread },
      );
      if (!res.text.includes('github.com/mastra-ai/mastra')) {
        throw new Error(`No se obtuvo la URL esperada. Respuesta: ${res.text.slice(0, 300)}`);
      }
      return { details: res.text.slice(0, 600) };
    },
  },
  {
    id: 'workflow-investigacion',
    category: 'Workflow',
    name: 'Workflow de investigación end-to-end',
    useCase: 'Proceso determinista: genera 3 consultas → busca en la web → sintetiza un informe con citas.',
    fn: async () => {
      const wf = mastra.getWorkflow('researchWorkflow');
      const run = await wf.createRun();
      const result = await run.start({ inputData: { topic: 'qué es el framework Mastra y para qué sirve' } });
      const report = (result as { result?: { report?: string } })?.result?.report ?? '';
      if (report.length < 400) throw new Error(`Informe demasiado corto (${report.length} chars)`);
      const hasSources = report.includes('http');
      if (!hasSources) throw new Error('El informe no incluye fuentes');
      return { details: `Informe generado (${report.length} caracteres):\n\n${report.slice(0, 700)}...` };
    },
  },
  {
    id: 'error-404-manejado',
    category: 'Robustez',
    name: 'Error HTTP gestionado con mensaje claro',
    useCase: 'Al pedir una URL inexistente, la herramienta falla de forma controlada con un error descriptivo.',
    fn: async () => {
      try {
        await fetchUrl('https://api.github.com/repos/mastra-ai/repo-que-no-existe-98765', 1000);
        throw new Error('La llamada debería haber fallado con 404');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('debería haber fallado')) throw e;
        if (!msg.includes('404')) throw new Error(`Error inesperado: ${msg}`);
        return { details: `Error capturado como se esperaba: "${msg}"` };
      }
    },
  },
];
