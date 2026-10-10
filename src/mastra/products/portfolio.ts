import { productsForCountry, type Product, type AssetClass } from './catalog';

export type InvestorProfile = {
  country: string; // ISO-2 o nombre (ES, MX, DE...)
  age?: number | null;
  horizonYears: number;
  riskTolerance: 1 | 2 | 3 | 4 | 5; // 1 = conservador, 5 = agresivo
  capital?: number | null;
  currency?: string;
  objective?: string;
  constraints?: string[];
  experience?: 'ninguna' | 'baja' | 'media' | 'alta' | null;
};

export type Sleeve = {
  assetClass: AssetClass;
  weightPct: number;
  rationale: string;
};

export type Allocation = {
  sleeves: Sleeve[];
  assumptions: string[];
};

export type Pick = {
  sleeve: AssetClass;
  weightPct: number;
  product: Product;
  fiscalNote: string | null;
};

const BASE_EQUITY_BY_RISK: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 95 };

const EQUITY_CLASSES: AssetClass[] = ['renta-variable-global', 'renta-variable-eeuu', 'renta-variable-em', 'renta-variable-europa'];

export function horizonCap(horizonYears: number): number {
  if (horizonYears < 3) return 30;
  if (horizonYears < 7) return 60;
  if (horizonYears < 15) return 90;
  return 100;
}

export function buildAllocation(profile: InvestorProfile): Allocation {
  const assumptions: string[] = [];
  const risk = profile.riskTolerance;
  const cap = horizonCap(profile.horizonYears);
  let equity = Math.min(BASE_EQUITY_BY_RISK[risk], cap);
  if (cap < BASE_EQUITY_BY_RISK[risk]) {
    assumptions.push(`Horizonte de ${profile.horizonYears} años limita la renta variable al ${cap}% aunque el perfil pida más.`);
  }

  const sleeves: Sleeve[] = [];
  sleeves.push({ assetClass: 'renta-variable-global', weightPct: Math.round(equity * 0.8), rationale: 'Núcleo global diversificado: miles de empresas en una sola posición, el motor de la cartera.' });

  let remainder = 100 - Math.round(equity * 0.8);
  const satellite = Math.min(risk >= 4 ? 10 : 5, equity - Math.round(equity * 0.8) - (risk >= 5 ? 5 : 0));
  const emWeight = Math.max(0, Math.min(satellite, Math.round(satellite)));
  if (emWeight >= 5) {
    sleeves.push({ assetClass: 'renta-variable-em', weightPct: emWeight, rationale: 'Satélite de emergentes para sobreponderar respecto al global; mayor volatilidad.' });
    remainder -= emWeight;
  }

  const goldWeight = risk >= 3 ? Math.min(8, Math.max(3, Math.round(remainder * 0.2))) : 0;
  if (goldWeight > 0) {
    sleeves.push({ assetClass: 'oro', weightPct: goldWeight, rationale: 'Oro físico vía ETC: cobertura histórica contra inflación y eventos de cola.' });
    remainder -= goldWeight;
  }

  const bondsWeight = Math.max(0, remainder - 5);
  if (bondsWeight >= 5) {
    sleeves.push({
      assetClass: profile.horizonYears < 5 ? 'renta-fija-corto' : 'renta-fija-global',
      weightPct: bondsWeight,
      rationale:
        profile.horizonYears < 5
          ? 'Renta fija de muy corto plazo: estabilidad para un horizonte breve.'
          : 'Renta fija global cubierta a tu divisa: amortiguador cuando la bolsa cae.',
    });
    remainder -= bondsWeight;
  }

  if (remainder > 0) {
    sleeves.push({ assetClass: 'liquidez', weightPct: remainder, rationale: 'Colchón de liquidez remunerada para aportaciones graduales e imprevistos.' });
  }

  assumptions.push('Asignación generada por reglas deterministas a partir de tu perfil; no constituye asesoramiento financiero personalizado.');
  return { sleeves, assumptions };
}

export type PortfolioPick = {
  profile: InvestorProfile;
  allocation: Allocation;
  picks: Pick[];
  warnings: string[];
};

export function selectProducts(profile: InvestorProfile): PortfolioPick {
  const allocation = buildAllocation(profile);
  const available = productsForCountry(profile.country);
  const warnings: string[] = [];
  const country = profile.country.toUpperCase();

  if (available.length === 0) {
    warnings.push(`Sin productos del catálogo verificados para "${profile.country}": consulta un asesor local y brokers con acceso UCITS.`);
  }

  const picks: Pick[] = [];
  for (const sleeve of allocation.sleeves) {
    const inClass = available.filter(p => p.assetClass === sleeve.assetClass);
    if (inClass.length === 0) {
      warnings.push(`Sin producto del catálogo para "${sleeve.assetClass}" en ${country}; considera alternativas con tu broker.`);
      continue;
    }
    // Preferencia fiscal: en ES los fondos permiten traspaso sin peaje → priorizar 'fondo' en núcleo
    const sorted = [...inClass].sort((a, b) => {
      const esFondo = (p: Product) => (country === 'ES' && p.type === 'fondo' ? 0 : 1);
      const byType = esFondo(a) - esFondo(b);
      return byType !== 0 ? byType : a.ter - b.ter;
    });
    const product = sorted[0];
    picks.push({
      sleeve: sleeve.assetClass,
      weightPct: sleeve.weightPct,
      product,
      fiscalNote: product.fiscalNote[country] ?? null,
    });
  }

  if (country === 'ES') {
    warnings.push('Recuerda: en España los traspasos sin peaje solo operan entre FONDOS de inversión (no hacia/desde ETFs). Planifica ventas con eso en mente.');
  }
  if (country === 'US') {
    warnings.push('Residente en EE. UU.: los ETFs UCITS europeos suelen estar bloqueados por reglas SEC (PRIIPs); usa ETFs domésticos equivalentes.');
  }

  return { profile, allocation, picks, warnings };
}
