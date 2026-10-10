import { defineSchedule } from '@mastra/core/agent';

export default defineSchedule({
  name: 'briefing-matinal',
  cron: '0 9 * * 1-5',
  timezone: 'Europe/Madrid',
  prompt:
    'Es la apertura del mercado. Genera tu briefing matinal de mercados: cotizaciones de los índices principales ' +
    '(S&P 500, Euro Stoxx 50, IBEX 35), Bitcoin y Ethereum, tipos EUR/USD, y las 3-5 noticias macro más relevantes ' +
    'con source y fecha. Formato markdown, conciso, con fuentes y el disclaimer obligatorio.',
});
