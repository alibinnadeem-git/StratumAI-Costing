import type { EstimateCondition } from "@prisma/client";

export type CostLineLike = {
  quantity: number;
  materialCost: number;
  laborHoursPerUnit: number;
  laborNormal?: number | null;
  laborDifficult?: number | null;
  laborVeryDifficult?: number | null;
};

export type AdderLike = { type: "FIXED" | "PERCENT"; appliesTo: "DIRECT_COST" | "MATERIAL" | "LABOR"; amount: number };

export function laborHoursForCondition(line: CostLineLike, condition: EstimateCondition) {
  const selected = condition === "DIFFICULT"
    ? line.laborDifficult
    : condition === "VERY_DIFFICULT"
      ? line.laborVeryDifficult
      : line.laborNormal;
  return selected ?? line.laborHoursPerUnit;
}

export function calculateEstimate(params: {
  lines: CostLineLike[];
  adders: AdderLike[];
  laborRate: number;
  overheadPercent: number;
  profitMarginPercent: number;
  difficultyMultiplier: number;
  condition: EstimateCondition;
}) {
  const material = params.lines.reduce((sum, l) => sum + (Number(l.materialCost) || 0) * (Number(l.quantity) || 0), 0);
  const rawLaborHours = params.lines.reduce((sum, l) => sum + laborHoursForCondition(l, params.condition) * (Number(l.quantity) || 0), 0);
  const laborHours = rawLaborHours * (Number(params.difficultyMultiplier) || 1);
  const labor = laborHours * (Number(params.laborRate) || 0);
  const directCost = material + labor;

  let adders = 0;
  for (const a of params.adders) {
    const basis = a.appliesTo === "MATERIAL" ? material : a.appliesTo === "LABOR" ? labor : directCost;
    adders += a.type === "PERCENT" ? basis * ((Number(a.amount) || 0) / 100) : (Number(a.amount) || 0);
  }
  const subtotalWithAdders = directCost + adders;
  const overhead = subtotalWithAdders * ((Number(params.overheadPercent) || 0) / 100);
  const subtotalAfterOverhead = subtotalWithAdders + overhead;
  const profit = subtotalAfterOverhead * ((Number(params.profitMarginPercent) || 0) / 100);
  const total = subtotalAfterOverhead + profit;

  return { material, rawLaborHours, laborHours, labor, directCost, adders, overhead, profit, total };
}

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
