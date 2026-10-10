import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export type FirePlanInput = {
  currentAge: number;
  targetAge: number;
  currentLiquid: number;
  annualContribution: number;
  contributionGrowth?: number;
  realReturnPct?: number;
  targetMonthlyIncome: number;
  savingsTaxPct?: number;
  concentratedPosition?: {
    grossValue: number;
    workIncomeTaxPct?: number;
    appreciationMultiplier?: number;
    liquidationAge?: number;
  } | null;
};

export type FirePlanResult = {
  years: number;
  corpusAtTarget: number;
  basisAtTarget: number;
  gainFraction: number;
  effectiveWithdrawalTaxPct: number;
  grossMonthlyWithdrawal: number;
  netMonthlyWithdrawal: number;
  requiredCorpus: number;
  reached: boolean;
  gap: number;
  concentrationScenarios?: {
    name: string;
    grossAtExit: number;
    irpf: number;
    netAtExit: number;
    deployedAtTarget: number;
    totalCorpus: number;
    netMonthly: number;
  }[];
  vestingSplitNote?: string;
  assumptions: string[];
};

export function firePlan(input: FirePlanInput): FirePlanResult {
  const {
    currentAge,
    targetAge,
    currentLiquid,
    annualContribution,
    contributionGrowth = 0,
    realReturnPct = 6,
    targetMonthlyIncome,
    savingsTaxPct = 21,
    concentratedPosition = null,
  } = input;

  const years = targetAge - currentAge;
  const r = realReturnPct / 100;
  const assumptions: string[] = [
    `Retorno real asumido: ${realReturnPct}% (después de inflación). Ajusta según cartera y horizonte.`,
    'Regla de retirada: SWR 4% sobre el corpus al año objetivo.',
    `Impuesto de retirada: escala del ahorro ${savingsTaxPct}% aplicada solo a la fracción de ganancia (la devolución de tu aportación no tributa).`,
  ];

  // 1. Corpus con aportaciones crecientes + base de coste acumulada
  let corpus = currentLiquid;
  let contrib = annualContribution;
  let basis = currentLiquid;
  for (let y = 0; y < years; y++) {
    corpus = corpus * (1 + r) + contrib;
    basis += contrib;
    contrib += contributionGrowth;
  }
  const gainFraction = Math.max(0, (corpus - basis) / corpus);
  const effWithdrawalTax = gainFraction * (savingsTaxPct / 100);
  const grossMonthly = (corpus * 0.04) / 12;
  const netMonthly = grossMonthly * (1 - effWithdrawalTax);
  const requiredCorpus = (targetMonthlyIncome * 12) / 0.04 / (1 - effWithdrawalTax);
  const reached = netMonthly >= targetMonthlyIncome;

  const result: FirePlanResult = {
    years,
    corpusAtTarget: Math.round(corpus),
    basisAtTarget: Math.round(basis),
    gainFraction: Math.round(gainFraction * 100) / 100,
    effectiveWithdrawalTaxPct: Math.round(effWithdrawalTax * 1000) / 10,
    grossMonthlyWithdrawal: Math.round(grossMonthly),
    netMonthlyWithdrawal: Math.round(netMonthly),
    requiredCorpus: Math.round(requiredCorpus),
    reached,
    gap: Math.round(Math.max(0, requiredCorpus - corpus)),
    assumptions,
  };

  // 2. Posición concentrada (RSU/options): revalorización → IRPF de trabajo → reinversión
  if (concentratedPosition) {
    const { grossValue, workIncomeTaxPct = 44, appreciationMultiplier = 1.5, liquidationAge = currentAge + 3 } = concentratedPosition;
    const growthYears = Math.max(0, targetAge - liquidationAge);
    const scenarios: NonNullable<FirePlanResult['concentrationScenarios']> = [];
    const multiplierSet: [string, number][] = [
      ['oso 0.8x', 0.8],
      ['base 1.5x', 1.5],
      ['toro 2.5x', 2.5],
    ];
    if (appreciationMultiplier !== 1.5) multiplierSet.push([`escenario dado ${appreciationMultiplier}x`, appreciationMultiplier]);

    for (const [name, mult] of multiplierSet) {
      const grossAtExit = grossValue * mult;
      const irpf = grossAtExit * (workIncomeTaxPct / 100);
      const netAtExit = grossAtExit - irpf;
      const deployedAtTarget = netAtExit * Math.pow(1 + r, growthYears);
      const totalCorpus = corpus + deployedAtTarget;
      const netMonthlySc = (totalCorpus * 0.04 * (1 - effWithdrawalTax)) / 12;
      scenarios.push({
        name,
        grossAtExit: Math.round(grossAtExit),
        irpf: Math.round(irpf),
        netAtExit: Math.round(netAtExit),
        deployedAtTarget: Math.round(deployedAtTarget),
        totalCorpus: Math.round(totalCorpus),
        netMonthly: Math.round(netMonthlySc),
      });
    }
    result.concentrationScenarios = scenarios;
    result.vestingSplitNote = `Materializar en un solo año dispara el marginal (~44% con salario medio); escalonar el vesting en 2-3 años baja el tipo efectivo (~36%) y puede ahorrar ~10-15% del importe. Verifica con asesor fiscal.`;
    assumptions.push('Posición concentrada: IRPF de trabajo sobre el bruto en la materialización (retención a cuenta del emisor); el neto se reinvierte en la cartera diversificada.');
  }

  return result;
}

export const firePlanTool = createTool({
  id: 'fire-plan',
  description:
    'Calculadora determinista de independencia financiera (FIRE) neta de impuestos: corpus objetivo con drag fiscal de las retiradas (solo la ganancia tributa), aportaciones crecientes y modelado de posiciones concentradas (RSU/options: revalorización → IRPF de trabajo → reinversión). Úsala para objetivos de jubilación anticipada o rentas futuras.',
  inputSchema: z.object({
    currentAge: z.number().int().min(18).max(90),
    targetAge: z.number().int().min(19).max(95),
    currentLiquid: z.number().min(0).describe('Patrimonio líquido invertible hoy'),
    annualContribution: z.number().min(0).describe('Aportación anual actual'),
    contributionGrowth: z.number().min(0).default(0).describe('Crecimiento anual de la aportación en € absolutos (p. ej. 3000 si tus ingresos suben)'),
    realReturnPct: z.number().min(0).max(15).default(6).describe('Retorno real esperado %'),
    targetMonthlyIncome: z.number().min(1).describe('Renta neta objetivo al retirarte'),
    savingsTaxPct: z.number().min(0).max(60).default(21).describe('Tipo medio de la escala del ahorro en tu país'),
    concentratedPosition: z
      .object({
        grossValue: z.number().describe('Valor bruto actual de la posición (RSU/options)'),
        workIncomeTaxPct: z.number().min(0).max(70).default(44).describe('IRPF marginal en la materialización (rendimiento del trabajo)'),
        appreciationMultiplier: z.number().min(0).default(1.5).describe('Multiplicador esperado hasta la ventana de liquidez'),
        liquidationAge: z.number().int().optional().describe('Edad estimada de liquidación'),
      })
      .nullable()
      .optional(),
  }),
  outputSchema: z.object({
    years: z.number(),
    corpusAtTarget: z.number(),
    basisAtTarget: z.number(),
    gainFraction: z.number(),
    effectiveWithdrawalTaxPct: z.number(),
    grossMonthlyWithdrawal: z.number(),
    netMonthlyWithdrawal: z.number(),
    requiredCorpus: z.number(),
    reached: z.boolean(),
    gap: z.number(),
    concentrationScenarios: z
      .array(
        z.object({
          name: z.string(),
          grossAtExit: z.number(),
          irpf: z.number(),
          netAtExit: z.number(),
          deployedAtTarget: z.number(),
          totalCorpus: z.number(),
          netMonthly: z.number(),
        }),
      )
      .optional(),
    vestingSplitNote: z.string().optional(),
    assumptions: z.array(z.string()),
  }),
  execute: async input => firePlan(input as FirePlanInput),
});
