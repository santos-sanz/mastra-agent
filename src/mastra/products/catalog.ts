// Catálogo educativo de productos de inversión accesibles para inversores retail.
// NOTA: catálogo de referencia con fines educativos — verifica ISIN, TER vigente y
// disponibilidad en tu broker antes de operar. Las condiciones fiscales cambian.

export type AssetClass =
  | 'renta-variable-global'
  | 'renta-variable-eeuu'
  | 'renta-variable-em'
  | 'renta-variable-europa'
  | 'renta-fija-global'
  | 'renta-fija-corto'
  | 'oro'
  | 'cripto'
  | 'liquidez';

export type ProductType = 'fondo' | 'etf' | 'etc' | 'money-market' | 'cripto';

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  assetClass: AssetClass;
  ticker: string; // ticker de Yahoo Finance para datos en vivo
  isin?: string;
  domicile: 'UCITS-IE' | 'UCITS-LU' | 'UCITS-FR' | 'US' | 'ES';
  ter: number; // % anual
  accumulation: boolean;
  currency: 'EUR' | 'USD';
  /** Países donde es accesible a retail; '*' = amplia disponibilidad UE/vía brokers globales */
  countries: string[];
  /** Nota fiscal por país (educativa; verifica con asesor) */
  fiscalNote: Partial<Record<string, string>>;
  note?: string;
};

export const CATALOG: Product[] = [
  {
    id: 'vanguard-global-stock-fund',
    name: 'Vanguard Global Stock Index Fund EUR Acc',
    type: 'fondo',
    assetClass: 'renta-variable-global',
    ticker: 'VGTSX',
    isin: 'IE00B03HD191',
    domicile: 'UCITS-IE',
    ter: 0.17,
    accumulation: true,
    currency: 'EUR',
    countries: ['ES', 'PT', 'MX'],
    fiscalNote: {
      ES: 'Fondo UCITS: traspasable sin peaje fiscal entre fondos (no entre ETFs). Plusvalías al reintegro: 19-28% según base.',
    },
    note: 'Fondo indexado global (MSCI World + small caps aprox. vía FTSE All-World ex unique). El vehículo preferido en España por el traspaso fiscal.',
  },
  {
    id: 'vanguard-global-bond-fund',
    name: 'Vanguard Global Bond Index Fund EUR Hedged Acc',
    type: 'fondo',
    assetClass: 'renta-fija-global',
    ticker: 'VBMFX',
    isin: 'IE00B18GC888',
    domicile: 'UCITS-IE',
    ter: 0.15,
    accumulation: true,
    currency: 'EUR',
    countries: ['ES', 'PT'],
    fiscalNote: {
      ES: 'Fondo UCITS: traspasable sin peaje fiscal. Cupones capitalizados internamente (acumulación).',
    },
    note: 'Renta fija global cubierta a EUR, duración media ~6 años.',
  },
  {
    id: 'vwce',
    name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
    type: 'etf',
    assetClass: 'renta-variable-global',
    ticker: 'VWCE',
    isin: 'IE00BK5BQT80',
    domicile: 'UCITS-IE',
    ter: 0.22,
    accumulation: true,
    currency: 'EUR',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF UCITS: NO traspasable con fondos de inversión; tributa como acciones (19-28% en venta). Acumulación difiere el peaje de dividendos.',
      DE: 'Vorabpauschale anual sobre ganancias no distribuidas; exención de 1.000 EUR/año de rendimiento de capital (2024).',
      MX: 'No listado en BMV: solo vía brokers internacionales con cuenta en euros/dólares.',
    },
    note: 'El ETF global UCITS de referencia: ~3.700 acciones, 9 países desarrollados + emergentes.',
  },
  {
    id: 'swda',
    name: 'iShares Core MSCI World UCITS ETF (Acc)',
    type: 'etf',
    assetClass: 'renta-variable-global',
    ticker: 'SWDA',
    isin: 'IE00B4L5Y983',
    domicile: 'UCITS-IE',
    ter: 0.2,
    accumulation: true,
    currency: 'EUR',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF UCITS: tributa como acciones; sin traspaso con fondos. Acumulación.',
      UK: 'Elegible en ISA/SIPP.',
    },
    note: 'Alternativa a VWCE sin emergentes (solo desarrollados, ~1.400 acciones).',
  },
  {
    id: 'eimi',
    name: 'iShares Core MSCI EM UCITS ETF (Acc)',
    type: 'etf',
    assetClass: 'renta-variable-em',
    ticker: 'EIMI',
    isin: 'IE00B0M62X26',
    domicile: 'UCITS-IE',
    ter: 0.18,
    accumulation: true,
    currency: 'EUR',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF UCITS: tributa como acciones. Retención en origen de dividendos de emergentes ya internalizada en el precio del ETF.',
    },
    note: 'Satélite de emergentes si se quiere sobreponderar respecto al global.',
  },
  {
    id: 'aggh',
    name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)',
    type: 'etf',
    assetClass: 'renta-fija-global',
    ticker: 'AGGH',
    isin: 'IE00BDBRDM35',
    domicile: 'UCITS-IE',
    ter: 0.1,
    accumulation: true,
    currency: 'EUR',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF UCITS cubierto a EUR: elimina el riesgo divisa de la renta fija. Tributa como acciones.',
      DE: 'Vorabpauschale aplicable.',
    },
    note: 'Bonos globales agregados cubiertos a EUR — la alternativa ETF al fondo de Vanguard.',
  },
  {
    id: 'xeon',
    name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF',
    type: 'money-market',
    assetClass: 'liquidez',
    ticker: 'XEON',
    isin: 'LU0290358497',
    domicile: 'UCITS-LU',
    ter: 0.1,
    accumulation: true,
    currency: 'EUR',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF monetario UCITS réplica sintética: réplica el tipo overnight EUR (€STR). Tributa como acciones.',
    },
    note: 'Liquidez remunerada ≈ tipo BCE; alternativa a depósitos para el colchón de la cartera.',
  },
  {
    id: 'sgln',
    name: 'iShares Physical Gold ETC',
    type: 'etc',
    assetClass: 'oro',
    ticker: 'SGLN',
    isin: 'IE00B579F325',
    domicile: 'UCITS-IE',
    ter: 0.12,
    accumulation: true,
    currency: 'USD',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETC de oro físico: tributa como acciones en venta (no es metal físico). Divisa USD: riesgo cambiario propio del activo.',
    },
    note: 'Oro físico segregado en Suiza; cobertura clásica contra inflación y colas.',
  },
  {
    id: 'vusa',
    name: 'Vanguard S&P 500 UCITS ETF (Acc)',
    type: 'etf',
    assetClass: 'renta-variable-eeuu',
    ticker: 'VUSA',
    isin: 'IE00B3XXRP09',
    domicile: 'UCITS-IE',
    ter: 0.07,
    accumulation: true,
    currency: 'USD',
    countries: ['*'],
    fiscalNote: {
      ES: 'ETF UCITS: tributa como acciones. Domiciliado en Irlanda: retención del 15% sobre dividendos de EE. UU. (mejor que 30% directo).',
      UK: 'Elegible en ISA/SIPP.',
    },
    note: 'Núcleo EE. UU. puro si se quiere desacoplar del global.',
  },
  {
    id: 'ib01',
    name: 'iShares $ Treasury Bond 0-1yr UCITS ETF (Acc)',
    type: 'etf',
    assetClass: 'renta-fija-corto',
    ticker: 'IB01',
    isin: 'IE00BGSF1X88',
    domicile: 'UCITS-IE',
    ter: 0.07,
    accumulation: true,
    currency: 'USD',
    countries: ['*'],
    fiscalNote: {
      ES: 'Letras del Tesoro EE. UU. a corto vía ETF UCITS: sin riesgo de duración, riesgo divisa USD.',
    },
    note: 'Corto plazo en USD: útil como liquidez remunerada en divisa americana.',
  },
  {
    id: 'btce',
    name: 'iShares Bitcoin ETC',
    type: 'etc',
    assetClass: 'cripto',
    ticker: 'IB1T',
    isin: 'IE00B8CN8304',
    domicile: 'UCITS-IE',
    ter: 0.25,
    accumulation: true,
    currency: 'USD',
    countries: ['ES', 'DE', 'UK', 'IT', 'FR'],
    fiscalNote: {
      ES: 'ETC de bitcoin: tributa como acciones en venta (ventaja operativa frente a custodia propia, donde tributa como plusvalía genérica igualmente).',
      DE: 'Tras 1 año de tenencia, las plusvalías privadas de cripto pueden estar exentas (verificar con asesor); vía ETC aplica el régimen de valores.',
    },
    note: 'Exposición a bitcoin sin custodia propia; solo como satélite pequeño de carteras agresivas.',
  },
];

export function productsForCountry(country: string): Product[] {
  const c = country.toUpperCase();
  return CATALOG.filter(p => p.countries.includes('*') || p.countries.includes(c));
}

export function findProduct(id: string): Product | undefined {
  return CATALOG.find(p => p.id === id);
}
