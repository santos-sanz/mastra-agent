import type { TestResult } from './suite';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CATEGORY_USE_CASES: Record<string, string> = {
  'Chat y memoria': 'Conversación en lenguaje natural con un analista financiero que recuerda contexto: hechos dentro de la misma conversación (historial) y entre sesiones distintas del mismo usuario (working memory por recurso), persistidos en LibSQL.',
  'Herramientas web': 'Información cualitativa de la web: búsqueda (keyless primero, Tavily como upgrade cuando el resultado es pobre) y lectura de páginas concretas.',
  'Datos de mercado': 'Ciclo completo de datos de mercado: resolver nombre→ticker, cotización con retardo declarado, series históricas con gráfico SVG, fundamentales (P/E, márgenes, ROE vía Yahoo crumb), cripto (CoinGecko), divisas (BCE), macro oficial (Banco Mundial), filings de la SEC y noticias (Google News → Tavily).',
  'RAG (base de conocimiento)': 'Conocimiento económico indexado: glosario, metodología de análisis y tipos de activos, embebidos con qwen3-embedding y recuperados con rerank del gateway NaN para responder preguntas conceptuales con fundamento.',
  Multimodal: 'Generación de ilustraciones (qwen-image-2.1), resúmenes en audio (kokoro) y transcripción de notas de voz (whisper).',
  'Agentes estructurados': 'Extracción de datos con schemas Zod y arquitectura multi-agente: el analista principal delega en especialistas (market-analyst cuantitativo, macro-analyst, researcher, extractor, writer).',
  'Workflow financiero': 'Procesos deterministas de análisis: company-analysis (empresa completa con disclaimer), asset-comparison (rentabilidad/volatilidad/valuación de 2+ activos) y market-briefing (snapshot diario de índices, cripto, FX y macro).',
  Robustez: 'Los fallos externos (URLs inexistentes, tickers inválidos, servicios caídos) se propagan como errores claros en lugar de provocar respuestas alucinadas o datos basura.',
};

export function renderReport(results: TestResult[], env: { mastraVersion: string; nodeVersion: string }): string {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.length - passed;
  const totalMs = results.reduce((a, r) => a + r.durationMs, 0);
  const rate = Math.round((passed / results.length) * 100);
  const now = new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
  const gateway = process.env.NAN_URL ?? '';
  const categories = [...new Set(results.map(r => r.category))];

  const card = (r: TestResult) => {
    const rel = (p: string) => p.replace(process.cwd() + '/', '');
    const artifacts = (r.artifacts ?? [])
      .map(a =>
        a.type === 'audio'
          ? `<audio class="artifact" controls src="${esc(rel(a.path))}"></audio>`
          : `<img class="artifact" src="${esc(rel(a.path))}" alt="${a.type}" loading="lazy">`,
      )
      .join('');
    return `
    <div class="test ${r.status}">
      <div class="test-head">
        <span class="badge ${r.status}">${r.status === 'pass' ? '✓ PASS' : '✗ FAIL'}</span>
        <span class="test-name">${esc(r.name)}</span>
        <span class="dur">${(r.durationMs / 1000).toFixed(1)}s</span>
      </div>
      ${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}
      <details ${r.status === 'fail' ? 'open' : ''}>
        <summary>Evidencia</summary>
        <pre>${esc(r.details || '(sin detalle)')}</pre>
      </details>
      ${artifacts}
    </div>`;
  };

  const sections = categories
    .map(cat => {
      const catResults = results.filter(r => r.category === cat);
      const catPass = catResults.filter(r => r.status === 'pass').length;
      return `
    <section>
      <h2>${esc(cat)} <span class="cat-score">${catPass}/${catResults.length}</span></h2>
      <p class="use-case">${esc(CATEGORY_USE_CASES[cat] ?? '')}</p>
      ${catResults.map(card).join('\n')}
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mastra-agent — Informe de pruebas de uso</title>
<style>
  :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #e6edf3; --muted: #8b949e;
          --green: #3fb950; --red: #f85149; --accent: #58a6ff; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
         line-height: 1.55; padding: 2rem; max-width: 980px; margin: 0 auto; }
  h1 { font-size: 1.7rem; margin-bottom: .3rem; }
  h1 span { color: var(--accent); }
  .meta { color: var(--muted); font-size: .85rem; margin-bottom: 1.5rem; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .kpi { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center; }
  .kpi .num { font-size: 1.9rem; font-weight: 700; }
  .kpi .lbl { color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; }
  .kpi.ok .num { color: var(--green); } .kpi.bad .num { color: var(--red); } .kpi.time .num { font-size: 1.4rem; }
  .bar { height: 10px; background: var(--red); border-radius: 6px; overflow: hidden; margin: 0 0 2rem; }
  .bar > div { height: 100%; background: var(--green); width: ${rate}%; }
  section { margin-bottom: 2.5rem; }
  h2 { font-size: 1.2rem; border-bottom: 1px solid var(--border); padding-bottom: .4rem; margin-bottom: .5rem; }
  h2 .cat-score { color: var(--muted); font-weight: 400; font-size: .9rem; float: right; }
  .use-case { color: var(--muted); font-size: .88rem; margin-bottom: 1rem; }
  .test { background: var(--card); border: 1px solid var(--border); border-left: 4px solid var(--border);
          border-radius: 10px; padding: .9rem 1.1rem; margin-bottom: .8rem; }
  .test.pass { border-left-color: var(--green); }
  .test.fail { border-left-color: var(--red); }
  .test-head { display: flex; align-items: center; gap: .7rem; }
  .test-name { font-weight: 600; flex: 1; }
  .dur { color: var(--muted); font-size: .8rem; font-variant-numeric: tabular-nums; }
  .badge { font-size: .68rem; font-weight: 700; padding: .15rem .5rem; border-radius: 20px; letter-spacing: .04em; }
  .badge.pass { background: rgba(63,185,80,.15); color: var(--green); }
  .badge.fail { background: rgba(248,81,73,.15); color: var(--red); }
  .err { color: var(--red); font-size: .85rem; margin-top: .5rem; font-family: ui-monospace, monospace; }
  details { margin-top: .6rem; }
  summary { cursor: pointer; color: var(--accent); font-size: .8rem; user-select: none; }
  pre { background: #0a0d12; border: 1px solid var(--border); border-radius: 8px; padding: .8rem;
        font-size: .78rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin-top: .5rem; }
  .artifact { display: block; margin-top: .7rem; max-width: 240px; border-radius: 8px; border: 1px solid var(--border); }
  audio.artifact { width: 100%; max-width: 420px; }
  footer { color: var(--muted); font-size: .8rem; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 2rem; }
  footer code { color: var(--accent); }
</style>
</head>
<body>
  <h1>🧪 <span>mastra-agent</span> — Informe de pruebas de uso</h1>
  <div class="meta">${esc(now)} · Modelo: <b>deepseek-v4-flash</b> vía ${esc(gateway)} · Mastra ${esc(env.mastraVersion)} · Node ${esc(env.nodeVersion)}</div>

  <div class="summary">
    <div class="kpi"><div class="num">${results.length}</div><div class="lbl">Tests</div></div>
    <div class="kpi ok"><div class="num">${passed}</div><div class="lbl">Éxitos</div></div>
    <div class="kpi ${failed > 0 ? 'bad' : ''}"><div class="num">${failed}</div><div class="lbl">Fallos</div></div>
    <div class="kpi time"><div class="num">${(totalMs / 1000).toFixed(0)}s</div><div class="lbl">Duración total</div></div>
  </div>
  <div class="bar"><div></div></div>

  ${sections}

  <footer>
    Generado automáticamente por la suite de tests (<code>npm run test:suite</code>).
    Cada test ejecuta el caso de uso real contra el gateway NaN: sin mocks.
  </footer>
</body>
</html>`;
}
