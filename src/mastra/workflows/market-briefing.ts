import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { writerAgent } from '../agents/writer-agent';
import { getQuote } from '../tools/market/quote';
import { getCryptoQuotes } from '../tools/market/crypto-quote';
import { getFxRates } from '../tools/market/fx-rates';
import { marketNews } from '../tools/market-news';

const MARKET_SNAPSHOT = {
  indices: ['^GSPC', '^STOXX50E', '^IBEX'],
  crypto: ['bitcoin', 'ethereum'],
};

const collectSnapshot = createStep({
  id: 'collect-snapshot',
  description: 'Índices principales, cripto top, EUR/USD y titulares macro.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    snapshot: z.string(),
  }),
  execute: async () => {
    const [indices, crypto, fx, news] = await Promise.all([
      Promise.all(MARKET_SNAPSHOT.indices.map(i => getQuote(i).catch(e => ({ symbol: i, error: String(e) })))),
      getCryptoQuotes(MARKET_SNAPSHOT.crypto).catch(() => []),
      getFxRates('EUR', ['USD', 'GBP']).catch(() => null),
      marketNews('bancos centrales tipos de interés economía', 5).catch(() => []),
    ]);

    const lines: string[] = [];
    for (const idx of indices) {
      if ('error' in idx) lines.push(`- ${idx.symbol}: ERROR (${idx.error.slice(0, 60)})`);
      else lines.push(`- ${idx.symbol} (${idx.name}): ${idx.price} ${idx.currency} (${idx.changePercent.toFixed(2)}% hoy)`);
    }
    for (const c of crypto) {
      lines.push(`- ${c.symbol}: $${c.price.USD?.toLocaleString('en-US')} / €${c.price.EUR?.toLocaleString('es-ES')} (${c.change24hPct?.toFixed(2) ?? '?'}% 24h)`);
    }
    if (fx) {
      lines.push(`- EUR/USD: ${fx.rates.USD} · EUR/GBP: ${fx.rates.GBP} (BCE, ${fx.date})`);
    }
    lines.push('\nTitulares macro:');
    lines.push(...news.map(n => `- (${n.date ?? 'sin fecha'}) ${n.title} — ${n.source} ${n.url}`));

    return { snapshot: lines.join('\n') };
  },
});

const writeBriefing = createStep({
  id: 'write-briefing',
  description: 'El writer redacta el briefing diario de mercados.',
  inputSchema: z.object({ snapshot: z.string() }),
  outputSchema: z.object({ report: z.string() }),
  execute: async ({ inputData }) => {
    const res = await writerAgent.generate(
      `Redacta el briefing diario de mercados en markdown con estos datos:\n${inputData.snapshot}\n\n` +
        `Estructura: ## Titular del día · ## Índices y activos (tabla) · ## Divisas · ## Qué vigilar hoy (2-3 puntos basados en las noticias) · ## Fuentes.\n` +
        `Tono: directo y profesional. No especules si el dato falta: márcalo. Cierra con: "⚠️ Información educativa, no asesoramiento financiero."`,
    );
    return { report: res.text };
  },
});

export const marketBriefingWorkflow = createWorkflow({
  id: 'market-briefing-workflow',
  description: 'Snapshot diario de mercados: índices, cripto top, EUR/USD y titulares macro con briefing redactado.',
  inputSchema: z.object({}),
  outputSchema: z.object({ report: z.string() }),
})
  .then(collectSnapshot)
  .then(writeBriefing)
  .commit();
