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
import { marketNews } from '../mastra/tools/market-news';
import { searchAsset } from '../mastra/tools/market/asset-search';
import { getQuote } from '../mastra/tools/market/quote';
import { getHistorical, priceChart } from '../mastra/tools/market/historical-prices';
import { getFinancials } from '../mastra/tools/market/financials';
import { getCryptoQuotes } from '../mastra/tools/market/crypto-quote';
import { getFxRates } from '../mastra/tools/market/fx-rates';
import { getMacro } from '../mastra/tools/market/macro-indicators';
import { getSecFilings } from '../mastra/tools/market/sec-filings';
import { resolveCompanySymbol } from '../mastra/workflows/company-analysis';
import { generateImage } from '../mastra/tools/generate-image';
import { speak } from '../mastra/tools/speak';
import { transcribeAudio } from '../mastra/tools/transcribe';
import { financialQualityScorer } from '../mastra/scorers/financial-quality';
import { FINANCIAL_DISCLAIMER } from '../mastra/processors/financial-disclaimer';
import morningBriefingSchedule from '../mastra/agents/analyst-agent/schedules/morning-briefing';

export type Artifact = { type: 'image' | 'audio' | 'chart'; path: string };

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

const DOCS = ['docs/conocimiento/glosario.md', 'docs/conocimiento/metodologia.md', 'docs/conocimiento/activos.md'];

async function indexKnowledgeDocs(): Promise<number> {
  const chunks: { text: string; source: string }[] = [];
  for (const f of DOCS) {
    const content = await readFile(join(process.cwd(), f), 'utf8');
    chunks.push({ text: content.slice(0, 1400), source: f });
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
    useCase: 'El usuario pregunta qué puede hacer el agente y recibe una respuesta coherente en su idioma.',
    fn: async () => {
      const agent = mastra.getAgent('analystAgent');
      const res = await agent.generate('¿Qué tipo de análisis financieros puedes hacer? Responde en máximo 2 frases.');
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
      const agent = mastra.getAgent('analystAgent');
      const thread = { thread: `t-${Date.now()}`, resource: 'test-user' };
      await agent.generate('Memoriza esto: el nombre clave de mi cartera es "Cartera Fénix". Solo confirma con OK.', { memory: thread });
      const res = await agent.generate('¿Cuál es el nombre clave de mi cartera?', { memory: thread });
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
      const agent = mastra.getAgent('analystAgent');
      const resource = `user-${Date.now()}`;
      await agent.generate('Guarda en tu memoria que invierto con horizonte largo plazo y que mi broker es DEGIRO.', {
        memory: { thread: `w1-${Date.now()}`, resource },
      });
      const res = await agent.generate('¿Qué horizonte de inversión tengo y qué broker uso?', {
        memory: { thread: `w2-${Date.now()}`, resource },
      });
      const ok = normalize(res.text).includes('largo') || normalize(res.text).includes('degiro');
      if (!ok) throw new Error(`No recordó entre sesiones. Respuesta: ${res.text}`);
      return { details: res.text };
    },
  },
  {
    id: 'web-search',
    category: 'Herramientas web',
    name: 'Búsqueda web con resultados reales',
    useCase: 'Información cualitativa de la web (con Tavily como upgrade si el resultado keyless es pobre).',
    fn: async () => {
      const { results } = await searchWeb('análisis fundamental valoración empresas', 5);
      if (results.length === 0) throw new Error('Búsqueda sin resultados');
      return { details: results.map(r => `- ${r.title} → ${r.url}`).join('\n') };
    },
  },
  {
    id: 'web-fetch',
    category: 'Herramientas web',
    name: 'Lectura y extracción de una página',
    useCase: 'Extraer el texto de una página web para razonar sobre él (finanzas).',
    fn: async () => {
      const page = await fetchUrl('https://es.wikipedia.org/wiki/An%C3%A1lisis_fundamental', 4000);
      if (page.text.length < 300) throw new Error(`Texto extraído insuficiente (${page.text.length} chars)`);
      return { details: `Título: ${page.title}\nCaracteres extraídos: ${page.text.length}\n\n${page.text.slice(0, 350)}...` };
    },
  },
  {
    id: 'market-asset-search',
    category: 'Datos de mercado',
    name: 'Resolución de nombre a ticker',
    useCase: '"Apple" → AAPL: el primer paso de cualquier análisis cuando el usuario no da el símbolo.',
    fn: async () => {
      const results = await searchAsset('apple', 5);
      if (!results.some(r => r.symbol === 'AAPL')) throw new Error(`AAPL no encontrado: ${results.map(r => r.symbol).join(', ')}`);
      return { details: results.map(r => `${r.symbol} (${r.type}, ${r.exchange}) — ${r.name}`).join('\n') };
    },
  },
  {
    id: 'market-resolve-privada',
    category: 'Datos de mercado',
    name: 'Resolución: privada vs cotizada',
    useCase: 'Una empresa privada (Anthropic) NO debe resolver a un vehículo cotizado (su ETF del ecosistema); una cotizada (Apple) sí a su EQUITY.',
    fn: async () => {
      const priv = await resolveCompanySymbol('Anthropic');
      if (priv.listed || priv.symbol) {
        throw new Error(`Anthropic (privada) resolvió incorrectamente a ${priv.symbol ?? '?'} (listed=${priv.listed})`);
      }
      const pub = await resolveCompanySymbol('Apple');
      if (!pub.listed || pub.symbol !== 'AAPL') {
        throw new Error(`Apple debería resolver a AAPL: ${JSON.stringify(pub)}`);
      }
      return { details: `Anthropic → no cotizada (correcto, sin ancla falsa) · Apple → AAPL (listed)` };
    },
  },
  {
    id: 'market-quote',
    category: 'Datos de mercado',
    name: 'Cotización en tiempo diferido',
    useCase: 'Precio actual, variación diaria y rango 52 semanas de una acción.',
    fn: async () => {
      const q = await getQuote('AAPL');
      if (!(q.price > 50)) throw new Error(`Precio sospechoso: ${q.price}`);
      if (q.currency !== 'USD') throw new Error(`Moneda inesperada: ${q.currency}`);
      return { details: `${q.name} (${q.exchange}): ${q.price} ${q.currency} (${q.changePercent.toFixed(2)}% hoy) · 52s: ${q.fiftyTwoWeekLow}–${q.fiftyTwoWeekHigh} · dato: ${q.marketTime}` };
    },
  },
  {
    id: 'market-historical',
    category: 'Datos de mercado',
    name: 'Serie histórica con gráfico SVG',
    useCase: 'Histórico 6 meses con métricas (rentabilidad, volatilidad) y gráfico generado en disco.',
    fn: async () => {
      const chart = await priceChart('AAPL', '6mo', '1wk');
      if (chart.points < 15) throw new Error(`Serie demasiado corta: ${chart.points} puntos`);
      const { exists, bytes } = await fileExists(chart.path);
      if (!exists || bytes < 500) throw new Error(`SVG inválido: ${bytes} bytes`);
      const hist = await getHistorical('AAPL', '6mo', '1wk');
      return {
        details: `Serie: ${hist.closes.length} puntos, de ${new Date(hist.timestamps[0] * 1000).toLocaleDateString('es-ES')} a ${new Date(hist.timestamps[hist.timestamps.length - 1] * 1000).toLocaleDateString('es-ES')}\nRentabilidad 6m: ${chart.changePercent.toFixed(2)}% · Volatilidad anualizada: ${chart.annualizedVolatilityPct.toFixed(1)}%\nGráfico: ${chart.path} (${(bytes / 1024).toFixed(1)} KB)`,
        artifacts: [{ type: 'chart', path: chart.path }],
      };
    },
  },
  {
    id: 'market-financials',
    category: 'Datos de mercado',
    name: 'Fundamentales de empresa cotizada',
    useCase: 'P/E, capitalización, márgenes, ROE y recomendación de analistas vía Yahoo (con crumb).',
    fn: async () => {
      const f = await getFinancials('AAPL');
      if (!f.trailingPE || f.trailingPE <= 0) throw new Error(`P/E inválido: ${f.trailingPE}`);
      if (!f.marketCap || f.marketCap < 1e9) throw new Error(`Market cap inválido: ${f.marketCap}`);
      return {
        details: `AAPL: cap. ${(f.marketCap / 1e12).toFixed(2)}T ${f.currency} · P/E ${f.trailingPE.toFixed(1)} (fwd ${f.forwardPE?.toFixed(1) ?? 'n/d'}) · beta ${f.beta?.toFixed(2) ?? 'n/d'} · márgen neto ${f.profitMarginPct?.toFixed(1) ?? 'n/d'}% · ROE ${f.returnOnEquityPct?.toFixed(1) ?? 'n/d'}% · recom: ${f.recommendation ?? 'n/d'} (target ${f.targetMeanPrice ?? 'n/d'})`,
      };
    },
  },
  {
    id: 'market-crypto',
    category: 'Datos de mercado',
    name: 'Cotización de criptomonedas',
    useCase: 'Precio de BTC en USD/EUR con variación 24h vía CoinGecko.',
    fn: async () => {
      const [btc] = await getCryptoQuotes(['bitcoin']);
      if (!(btc.price.USD > 1000)) throw new Error(`Precio BTC inválido: ${btc.price.USD}`);
      return { details: `${btc.name}: $${btc.price.USD.toLocaleString('en-US')} / €${btc.price.EUR?.toLocaleString('es-ES')} (${btc.change24hPct?.toFixed(2)}% 24h) · cap: $${((btc.marketCap ?? 0) / 1e9).toFixed(0)}B` };
    },
  },
  {
    id: 'market-fx',
    category: 'Datos de mercado',
    name: 'Tipos de cambio del BCE',
    useCase: 'Divisas de referencia para conversión de valores extranjeros.',
    fn: async () => {
      const fx = await getFxRates('EUR', ['USD', 'GBP']);
      const usd = fx.rates.USD;
      if (!(usd > 0.5 && usd < 2)) throw new Error(`EUR/USD fuera de rango razonable: ${usd}`);
      return { details: `EUR/USD: ${usd} · EUR/GBP: ${fx.rates.GBP} (BCE, ${fx.date})` };
    },
  },
  {
    id: 'market-macro',
    category: 'Datos de mercado',
    name: 'Indicadores macro oficiales',
    useCase: 'Inflación de España según el Banco Mundial (datos oficiales con retraso).',
    fn: async () => {
      const s = await getMacro('España', 'inflacion', 3);
      if (s.points.length === 0) throw new Error('Sin puntos de datos');
      return { details: `${s.label} — ${s.country}:\n${s.points.map(p => `  ${p.year}: ${(p.value ?? 0).toFixed(2)}%`).join('\n')}` };
    },
  },
  {
    id: 'market-sec-filings',
    category: 'Datos de mercado',
    name: 'Filings oficiales de la SEC',
    useCase: 'Documentos regulatorios (10-K, 10-Q, 8-K) de una empresa registrada en EE. UU.',
    fn: async () => {
      const { company, filings } = await getSecFilings('AAPL', 5);
      if (filings.length === 0) throw new Error('Sin filings');
      const hasPeriodic = filings.some(f => ['10-K', '10-Q'].includes(f.form));
      if (!hasPeriodic) throw new Error(`Sin 10-K/10-Q en: ${filings.map(f => f.form).join(', ')}`);
      return { details: `${company}:\n${filings.map(f => `- ${f.form} (${f.filedDate}) ${f.url}`).join('\n')}` };
    },
  },
  {
    id: 'market-news',
    category: 'Datos de mercado',
    name: 'Noticias de mercado',
    useCase: 'Titulares recientes con fuente y fecha (Google News RSS → Tavily).',
    fn: async () => {
      const news = await marketNews('bolsa mercado acciones', 5, 'es');
      if (news.length < 2) throw new Error(`Noticias insuficientes: ${news.length}`);
      return { details: news.map(n => `- (${n.date ?? 's/f'}) ${n.title} — ${n.source}`).join('\n') };
    },
  },
  {
    id: 'rag-indexado',
    category: 'RAG (base de conocimiento)',
    name: 'Indexación del corpus económico',
    useCase: 'Indexar glosario, metodología y tipos de activos con embeddings del gateway.',
    fn: async () => {
      const n = await indexKnowledgeDocs();
      return { details: `${n} documento(s) indexados en "${KNOWLEDGE_INDEX}" (${EMBEDDING_MODEL}).` };
    },
  },
  {
    id: 'rag-glosario',
    category: 'RAG (base de conocimiento)',
    name: 'Consulta conceptual: P/E',
    useCase: 'Pregunta económica general fundamentada en el glosario indexado.',
    fn: async () => {
      const results = await searchKnowledge('¿Qué significa el ratio P/E y cómo se interpreta?', 3);
      const hit = results.find(r => normalize(r.text).includes('price/earnings') || normalize(r.text).includes('p/e'));
      if (!hit) throw new Error(`No se recuperó el concepto. Fuentes: ${results.map(r => r.source).join(', ')}`);
      return { details: `Fuente: ${hit.source} (score ${hit.score.toFixed(3)})\n${hit.text.slice(0, 250)}...` };
    },
  },
  {
    id: 'imagen-generada',
    category: 'Multimodal',
    name: 'Generación de imagen',
    useCase: 'Ilustraciones generadas por el agente para acompañar análisis.',
    fn: async () => {
      const img = await generateImage('minimal flat vector icon of a bull and bear facing each other, stock market theme, blue and white palette', '512x512');
      const { exists, bytes } = await fileExists(img.path);
      if (!exists || bytes < 5000) throw new Error(`Archivo inválido: exists=${exists}, ${bytes} bytes`);
      return { details: `Imagen guardada en ${img.path} (${(bytes / 1024).toFixed(1)} KB)`, artifacts: [{ type: 'image', path: img.path }] };
    },
  },
  {
    id: 'voz-transcripcion',
    category: 'Multimodal',
    name: 'Voz sintetizada y transcrita',
    useCase: 'Resúmenes en audio (TTS) y transcripción de notas de voz del usuario (whisper).',
    fn: async () => {
      const texto = 'La prueba intensiva del analista financiero ha finalizado con éxito.';
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
    id: 'procesador-disclaimer',
    category: 'Cumplimiento y evaluación',
    name: 'Output processor: disclaimer garantizado',
    useCase: 'Un output processor añade el disclaimer legal a cualquier respuesta que se le olvide — cumplimiento por diseño, no por prompt.',
    fn: async () => {
      const agent = mastra.getAgent('analystAgent');
      const res = await agent.generate('¿Qué es el IBEX 35? Responde en una línea, sin disclaimer.');
      const t = normalize(res.text);
      if (!t.includes('educativa') && !t.includes('dyor')) {
        throw new Error(`El processor no añadió el disclaimer: ${res.text.slice(0, 200)}`);
      }
      return { details: res.text.slice(0, 400) };
    },
  },
  {
    id: 'scorer-calidad',
    category: 'Cumplimiento y evaluación',
    name: 'Scorer LLM-judge de calidad financiera',
    useCase: 'Un scorer evalúa cada respuesta (disclaimer, fuentes, solidez) y registra la puntuación; también auditable por separado.',
    fn: async () => {
      const msg = (role: 'user' | 'assistant', text: string, i: number) => ({
        id: `t-${i}`,
        role,
        createdAt: new Date(),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
      });
      const result = await financialQualityScorer.run({
        input: {
          inputMessages: [msg('user', '¿Cuánto vale Apple y es buena inversión?', 0)],
          rememberedMessages: [],
          systemMessages: [],
          taggedSystemMessages: {},
        },
        output: [
          msg(
            'assistant',
            'Apple (AAPL) cotiza a 275,40 USD en Nasdaq (dato de Yahoo Finance, puede ir con retardo). P/E 38.6, cap. 4.91T USD. Con estos múltiplos el mercado descuenta crecimiento alto; el riesgo principal es la dependencia de iPhone. [Fuente: Yahoo Finance]\n\n' +
              FINANCIAL_DISCLAIMER,
            1,
          ),
        ],
      });
      const score = result.score;
      if (typeof score !== 'number' || score < 0 || score > 1) throw new Error(`Score inválido: ${score}`);
      if (score < 0.6) throw new Error(`Respuesta de calidad debería puntuar alto: ${score}`);
      return { details: `score: ${score} · análisis: ${JSON.stringify(result.analyzeStepResult)}` };
    },
  },
  {
    id: 'schedule-briefing',
    category: 'Cumplimiento y evaluación',
    name: 'Schedule cron: briefing matinal',
    useCase: 'El briefing de mercados se ejecuta solo en días laborables a las 9:00 (CET) vía schedules de Mastra (se dispara en mastra dev / producción).',
    fn: async () => {
      const s = morningBriefingSchedule as unknown as { cron?: string; prompt?: string; timezone?: string; name?: string };
      if (s.cron !== '0 9 * * 1-5') throw new Error(`Cron inesperado: ${s.cron}`);
      if (!s.prompt || s.prompt.length < 50) throw new Error('Prompt del schedule vacío');
      return { details: `Schedule "${s.name ?? 'briefing-matinal'}" registrado: cron=${s.cron} (${s.timezone}), prompt de ${s.prompt.length} caracteres.` };
    },
  },
  {
    id: 'network-equipo',
    category: 'Agentes estructurados',
    name: 'Red de agentes (orquestación dinámica)',
    useCase: 'agent.network() enruta dinámicamente entre tools y sub-agentes hasta completar la tarea (router qwen3.6 por soporte json_schema).',
    fn: async () => {
      const agent = mastra.getAgent('analystAgent');
      const stream = await agent.network(
        'Consulta el precio actual de Bitcoin en USD y di en una línea si está por encima de 50.000.',
        { model: nan('qwen3.6') },
      );
      let text = '';
      for await (const chunk of stream as unknown as AsyncIterable<unknown>) {
        const c = chunk as { type?: string; text?: string; payload?: { text?: string } };
        if (typeof c?.text === 'string' && ['text', 'text-delta'].includes(c.type ?? '')) text += c.text;
        else if (c?.type === 'routing-agent-text-delta' && typeof c.payload?.text === 'string') text += c.payload.text;
      }
      const t = normalize(text);
      if (text.trim().length < 30) throw new Error(`Respuesta de red demasiado corta: "${text.slice(0, 120)}"`);
      if (!t.includes('bitcoin') && !t.includes('btc')) throw new Error(`Respuesta sin Bitcoin: ${text.slice(0, 150)}`);
      return { details: text.slice(0, 400) };
    },
  },
  {
    id: 'extraccion-estructurada',
    category: 'Agentes estructurados',
    name: 'Extracción de datos con schema Zod',
    useCase: 'De un email comercial en texto libre, campos estructurados y validados.',
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
    id: 'market-analyst-integracion',
    category: 'Agentes estructurados',
    name: 'Sub-agente market-analyst con tools',
    useCase: 'El analista cuantitativo resuelve en vivo: busca el símbolo y cita el precio con fuente.',
    fn: async () => {
      const agent = mastra.getAgent('marketAnalyst');
      const res = await agent.generate('¿Cuál es el precio actual de Apple? Responde en una línea con el símbolo, precio, moneda y fuente.');
      if (!normalize(res.text).includes('aapl')) throw new Error(`Respuesta sin símbolo: ${res.text.slice(0, 200)}`);
      if (!/\d{2,}/.test(res.text)) throw new Error(`Respuesta sin precio: ${res.text.slice(0, 200)}`);
      return { details: res.text.slice(0, 400) };
    },
  },
  {
    id: 'delegacion-subagente',
    category: 'Agentes estructurados',
    name: 'Delegación del orquestador en macro-analyst',
    useCase: 'El agente principal delega una pregunta económica en el sub-agente macro y sintetiza la respuesta.',
    fn: async () => {
      const agent = mastra.getAgent('analystAgent');
      const thread = { thread: `d-${Date.now()}`, resource: 'test-user' };
      const res = await agent.generate(
        'Delega en tu sub-agente macro-analyst esta pregunta: ¿cómo afecta la subida de tipos de interés a la inflación? Devuélveme su respuesta en 1-2 frases.',
        { memory: thread },
      );
      const ok = normalize(res.text).includes('inflacion') || normalize(res.text).includes('tipo');
      if (!ok) throw new Error(`Respuesta fuera de tema: ${res.text.slice(0, 200)}`);
      return { details: res.text.slice(0, 400) };
    },
  },
  {
    id: 'workflow-company-analysis',
    category: 'Workflow financiero',
    name: 'Análisis de empresa con revisión humana (suspend/resume)',
    useCase: 'El workflow recopila datos, SE SUSPENDE para revisión humana y se reanuda con aprobación para redactar el informe final con disclaimer.',
    fn: async () => {
      const wf = mastra.getWorkflow('companyAnalysisWorkflow');
      const run = await wf.createRun();
      const suspended = await run.start({ inputData: { company: 'Apple' } });
      if ((suspended as { status?: string }).status !== 'suspended') {
        throw new Error(`El workflow debería estar suspendido en review-gate, status: ${JSON.stringify((suspended as { status?: string }).status)}`);
      }
      const result = await run.resume({ resumeData: { approved: true } });
      const report = (result as { result?: { report?: string } })?.result?.report ?? '';
      if (report.length < 500) throw new Error(`Informe demasiado corto (${report.length} chars)`);
      if (!normalize(report).includes('educativa') || !normalize(report).includes('dyor')) {
        throw new Error('El informe no incluye el disclaimer obligatorio');
      }
      return { details: `Suspendido en review-gate ✓ → reanudado ✓ → informe (${report.length} caracteres):\n\n${report.slice(0, 500)}...` };
    },
  },
  {
    id: 'workflow-asset-comparison',
    category: 'Workflow financiero',
    name: 'Comparación de activos end-to-end',
    useCase: 'Compara AAPL vs MSFT: rentabilidad 1y, volatilidad y valuación con veredicto relativo.',
    fn: async () => {
      const wf = mastra.getWorkflow('assetComparisonWorkflow');
      const run = await wf.createRun();
      const result = await run.start({ inputData: { symbols: ['AAPL', 'MSFT'] } });
      const report = (result as { result?: { report?: string } })?.result?.report ?? '';
      if (report.length < 400) throw new Error(`Informe demasiado corto (${report.length} chars)`);
      if (!report.includes('AAPL') || !report.includes('MSFT')) throw new Error('Faltan los símbolos comparados');
      return { details: `Comparativa generada (${report.length} caracteres):\n\n${report.slice(0, 500)}...` };
    },
  },
  {
    id: 'workflow-market-briefing',
    category: 'Workflow financiero',
    name: 'Briefing de mercados end-to-end',
    useCase: 'Snapshot diario: S&P 500, Euro Stoxx, IBEX, BTC/ETH, EUR/USD y titulares macro.',
    fn: async () => {
      const wf = mastra.getWorkflow('marketBriefingWorkflow');
      const run = await wf.createRun();
      const result = await run.start({ inputData: {} });
      const report = (result as { result?: { report?: string } })?.result?.report ?? '';
      if (report.length < 300) throw new Error(`Briefing demasiado corto (${report.length} chars)`);
      if (!report.includes('GSPC') && !report.includes('S&P')) throw new Error('El briefing no menciona los índices');
      return { details: `Briefing generado (${report.length} caracteres):\n\n${report.slice(0, 500)}...` };
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
  {
    id: 'ticker-invalido',
    category: 'Robustez',
    name: 'Ticker inválido produce error claro',
    useCase: 'Un símbolo inexistente no debe devolver datos basura ni colgar: error explícito.',
    fn: async () => {
      try {
        await getQuote('SIMBOLO-QUE-NO-EXISTE-99999');
        throw new Error('getQuote debería haber fallado');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('debería haber fallado')) throw e;
        return { details: `Error capturado como se esperaba: "${msg.slice(0, 150)}"` };
      }
    },
  },
];
