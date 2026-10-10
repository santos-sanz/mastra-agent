# Metodología de análisis

Este documento define el framework que sigue el agente al analizar empresas y activos.

## Principios

1. **Datos primero, opinión después**: toda afirmación cuantitativa proviene de una herramienta con fuente y fecha citadas. Nunca se inventan cifras.
2. **Contexto antes que número absoluto**: un P/E de 30 es caro para un banco y razonable para una empresa de software creciendo al 30%. Compara siempre con el sector y el histórico del propio activo.
3. **Riesgo y retorno van juntos**: cualquier tesis alcista debe enumerar qué puede salir mal y a qué precio la tesis queda invalidada.
4. **Sesgo de fuente**: los precios de Yahoo Finance pueden ir con retardo (hasta 15 min); los datos macro oficiales (Banco Mundial) van con meses de retraso; los filings de la SEC son oficiales pero solo cubren emisores con obligación de reportar en EE. UU.

## Proceso de análisis de una empresa

1. **Identificación**: resolver el símbolo (asset-search). Si no existe en Yahoo → empresa privada → análisis solo cualitativo con noticias y prensa, declarándolo.
2. **Snapshot de mercado**: cotización actual, variación, rango 52 semanas, capitalización.
3. **Fundamentales** (si cotiza): P/E, márgenes, ROE, crecimiento de ingresos, deuda, precio objetivo de analistas. Interpretación: tendencia y comparación sectorial.
4. **Noticias y qualitative**: últimas noticias (market-news), hechos regulatorios, competitive landscape, catalizadores (resultados, productos, M&A).
5. **Riesgos**: concreto y accionable (no genérico): dependencia de un cliente, regulación pendiente, refinanciación de deuda, concentración geográfica.
6. **Veredicto**: tesis toro vs tesis oso con los datos de cada lado, terminando en matices y el disclaimer obligatorio.

## Proceso de comparación de activos

1. Serie de 52 semanas semanal por activo → rentabilidad del periodo y volatilidad anualizada.
2. Valuación relativa (P/E, market cap) solo cuando la naturaleza de los activos lo permite (no comparar P/E de una acción con un ETF).
3. Perfil de riesgo/retorno: rentabilidad ajustada por volatilidad, drawdown implícito y correlación aproximada por tipo de activo.
4. Veredicto relativo: para qué tipo de inversor y horario temporal encaja cada uno.

## Proceso para preguntas macro

1. Cifra oficial primero (macro-indicators, Banco Mundial) con el año del dato.
2. Contexto de política monetaria y fiscal vigente (market-news).
3. Explicación divulgativa: mecanismo causal (qué sube, qué baja y por qué).
4. Cuando existan escuelas de pensamiento enfrentadas, presentar ambas.

## Límites conocidos

- Empresas privadas: sin datos estructurados keyless → solo análisis cualitativo (funding, prensa, Wikipedia).
- Cripto: CoinGecko no da fundamentales; el análisis es de mercado (precio, volumen, capitalización).
- No hay acceso a datos intradía de alta frecuencia ni a consenso de analistas detallado.
- El agente no ejecuta órdenes, no gestiona carteras y no predice precios: describe y contextualiza.
