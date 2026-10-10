# mastra-agent — Agente de análisis financiero

Agente de análisis de empresas (públicas y privadas), activos tradeables y preguntas económicas generales, construido con [Mastra](https://mastra.ai) y el gateway de modelos [NaN](https://nan.builders). Diseñado para desplegarse en Cloudflare.

> ⚠️ **Disclaimer**: toda la salida del agente es información **educativa**, no asesoramiento financiero. Los datos pueden ir con retardo. Haz tu propia investigación (DYOR).

## Qué puede hacer

### Análisis de empresas
- **Cotizadas**: perfil (sector, empleados), cotización con rango 52 semanas, fundamentales (P/E, EV, márgenes, ROE, crecimiento, precio objetivo de analistas), histórico con gráfico, filings de la SEC y noticias.
- **Privadas**: análisis **cualitativo** (rondas de financiación, valoraciones en prensa, hechos relevantes) — no existen datos estructurados keyless para privadas; el agente lo declara explícitamente.

### Activos tradeables
Acciones, ETFs, índices, **cripto** (CoinGecko), **divisas** (tipos BCE) y materias primas vía futuros. Comparación de 2–5 activos con rentabilidad, volatilidad anualizada y valuación relativa.

### Preguntas económicas generales
Indicadores macro oficiales (Banco Mundial), tipos de cambio (BCE), conceptos explicados desde el glosario indexado (RAG) y contexto de actualidad (noticias).

### Workflows deterministas
| Workflow | Comando | Qué hace |
|---|---|---|
| **Análisis de empresa** | `npm run workflow -- analysis "Apple"` | símbolo → quote + fundamentales + noticias → investigación → **revisión humana (suspend/resume)** → informe con tesis toro/oso y disclaimer |
| **Comparación de activos** | `npm run workflow -- compare AAPL MSFT` | rentabilidad 1y, volatilidad, valuación → tabla comparativa y veredicto relativo |
| **Briefing de mercados** | `npm run workflow -- briefing` | S&P 500, Euro Stoxx, IBEX, BTC/ETH, EUR/USD + titulares macro |
| **Cartera recomendada** | `npm run workflow -- portfolio` | robo-advisor educativo: perfil → asignación determinista → productos accesibles y fiscalmente eficientes → informe |
| **Briefing automático** | — | schedule cron: días laborables 9:00 CET (se dispara en `mastra dev` / producción) |

### Robo-advisor educativo (carteras por perfil)

`npm run workflow -- portfolio` y `POST /custom/portfolio` construyen una cartera propuesta a partir de una descripción libre del inversor:

1. **Perfil estructurado**: país, horizonte, tolerancia al riesgo (1-5), capital y objetivo se extraen del texto (lo que falta se asume y se declara).
2. **Asignación determinista**: reglas riesgo×horizonte (sin LLM en la matemática): núcleo global, satélite de emergentes, bonos cubiertos, oro y liquidez.
3. **Selección accesible y fiscal**: catálogo curado de fondos/ETFs/ETCs UCITS filtrado por país — en España prioriza **fondos traspasables sin peaje fiscal**; en UE excluye productos US-domiciliados (PRIIPs); notas fiscales por país (acumulación, Vorabpauschale, wrappers ISA/Roth/PEA...).
4. **Informe del analista de producto**: tabla de cartera, justificación, fiscalidad del país, brokers de acceso, plan de aportaciones/rebalanceo, riesgos y disclaimer de no-asesoramiento (forzado por el output processor).

El catálogo vive en `src/mastra/products/catalog.ts` (ISINs, TERs, notas fiscales — educativo: verifica antes de operar) y el corpus fiscal en `docs/conocimiento/fiscalidad.md` (indexado en el RAG).

### Features de Mastra en uso
- **Agents + sub-agentes** con memoria persistente (LibSQL) y working memory por usuario
- **Orquestación dinámica**: `agent.network()` enruta entre tools y especialistas (`npm run network`)
- **Workflows** con steps tipados, `suspend()/resume()` para human-in-the-loop
- **Output processors**: el disclaimer legal se garantiza por código, no por prompt
- **Scorers (evals)**: LLM-judge que puntúa disclaimer/fuentes/solidez de cada respuesta
- **Agent schedules**: `schedules/morning-briefing.ts` con cron `0 9 * * 1-5`
- **API routes** custom (servidas por `mastra dev`):
  - `GET /custom/health`
  - `POST /custom/briefing`
  - `POST /custom/analysis` — body `{"company": "Apple"}`
  - `POST /custom/compare` — body `{"symbols": ["AAPL", "MSFT"]}`
  - `POST /custom/portfolio` — body `{"description": "Español de 35 años, 20.000 EUR, riesgo 4"}`
- **RAG** con LibSQLVector + rerank del gateway, **multimodal** (imágenes, TTS, whisper)

## Arquitectura

```
src/mastra/
├── index.ts                  → registro de Mastra (agentes, workflows, storage)
├── nan.ts                    → cliente del gateway NaN (chat, embeddings, TTS...)
├── storage.ts / memory.ts    → LibSQL (mastra.db) + memoria por usuario
├── agents/
│   ├── analyst-agent.ts      → ORQUESTADOR: analista financiero con memoria + 16 tools + 4 sub-agentes
│   ├── market-analyst.ts     → analista cuantitativo (precios, fundamentales, filings)
│   ├── macro-analyst.ts      → economista (macro oficial, divisas, divulgación)
│   ├── researcher-agent.ts   → investigación web con citas
│   ├── extractor-agent.ts    → extracción estructurada (Zod)
│   └── writer-agent.ts       → redacción de informes (sin tools)
├── tools/
│   ├── market/               → asset-search, quote, historical-prices (+SVG), company-profile,
│   │                           financials (crumb Yahoo), crypto-quote, fx-rates,
│   │                           macro-indicators, sec-filings
│   ├── market-news.ts        → Google News RSS → Tavily
│   ├── web-search.ts         → keyless (DDG/Wikipedia/GitHub/HN) → Tavily si pobre
│   ├── web-fetch.ts          → HTML → texto
│   └── knowledge-search.ts   → RAG con rerank del gateway
└── workflows/                → company-analysis, asset-comparison, market-briefing

docs/conocimiento/            → glosario, metodología y tipos de activos (corpus RAG)
src/tests/                    → suite de 26 tests de uso + generador del informe HTML
```

## Fuentes de datos (todas keyless salvo Tavily)

| Fuente | Datos | Límite conocido |
|---|---|---|
| Yahoo Finance | cotizaciones, históricos, fundamentales | retardo hasta 15 min; bloquea sin *crumb* (se gestiona automáticamente) |
| CoinGecko | cripto | sin fundamentales contables |
| Frankfurter (BCE) | divisas de referencia | sin cripto ni intradía |
| Banco Mundial | macro oficial | retraso de meses |
| SEC EDGAR | filings empresas EE. UU. | solo emisores registrados en EE. UU. |
| Google News RSS | noticias de mercado | titulares, sin cuerpo completo |
| Tavily *(opcional)* | búsqueda web completa | clave gratuita: 1000 req/mes |

## Setup

```bash
npm install
cp .env.example .env   # y rellena las claves
npm run rag:index -- docs/conocimiento   # indexa el corpus económico
```

Variables de entorno (`.env`, no versionado):

| Variable | Requerida | Descripción |
|---|---|---|
| `NAN_API_KEY` | ✅ | clave del gateway NaN |
| `NAN_URL` | ✅ | `https://api.nan.builders/v1` |
| `TAVILY_API_KEY` | opcional | mejora búsqueda web y noticias; el agente la usa solo cuando el resultado keyless es pobre |

Modelos del gateway usados: `deepseek-v4-flash` (chat), `qwen3-embedding` (RAG), `rerank`, `qwen-image-2.1` (imágenes), `kokoro` (voz), `whisper` (transcripción).

## Comandos

```bash
npm run chat            # conversación con el analista (memoria activa)
npm run network         # orquestación dinámica de agentes (agent.network)
npm run workflow -- analysis "Santander"    # análisis de empresa
npm run workflow -- compare AAPL MSFT SAN.MC
npm run workflow -- briefing
npm run workflow -- portfolio   # cartera educativa por perfil
npm run extract         # demo de extracción estructurada
npm run rag:index -- docs/conocimiento       # reindexar conocimiento
npm run rag:search -- "qué es el beta de una acción"
npm run dev             # playground + API server + schedules (localhost:4111)
npm run test:suite      # 30 tests de uso reales + informe HTML (test-report.html)
```

## Testing

La suite ejecuta cada caso de uso real contra el gateway y las fuentes (sin mocks): memoria, web, 9 tools de mercado, RAG, multimodal, sub-agentes, los 3 workflows end-to-end y robustez (ticker inválido, 404). Genera `test-report.html` con evidencias, gráficos y audio.

## Notas técnicas

- Modelos vía **Chat Completions** (`nan.chat`): el gateway no soporta `item_reference` de la Responses API.
- Structured output con `jsonPromptInjection: 'auto'` (`deepseek-v4-flash` no soporta `json_schema`).
- SEC EDGAR: búsqueda de CIK vía EDGAR full-text search (el registro de tickers está bloqueado por su WAF) y filtrado de Form 3/4/144/5 (ruido de insiders) por defecto.
- Despliegue previsto en Cloudflare Workers (storage LibSQL local → D1/Cloudflare en producción).
