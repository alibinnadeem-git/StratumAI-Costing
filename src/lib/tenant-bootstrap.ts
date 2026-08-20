import type { Prisma } from "@prisma/client";
import { DEFAULT_COST_ITEMS, DEFAULT_MARKET_FACTORS } from "./costing-data";

/** Seed the tenant-owned estimating defaults for a newly created organization. */
export async function bootstrapOrganization(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.costSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, laborRate: 95, overheadPercent: 12, profitMarginPercent: 15, difficultyMultiplier: 1, defaultCondition: "NORMAL" },
  });

  const existingItems = await tx.costItem.count({ where: { organizationId } });
  if (existingItems === 0) {
    await tx.costItem.createMany({
      data: DEFAULT_COST_ITEMS.map((item) => {
        const isVerifiedDuplex = item.description === "Duplex Receptacle, 15A, 3-wire, straight blade";
        return {
          organizationId,
          category: item.category,
          description: item.description,
          unit: item.unit,
          laborHoursPerUnit: item.laborHoursPerUnit,
          materialCost: item.materialCost,
          source: item.source,
          notes: item.notes,
          ...(isVerifiedDuplex ? {
            necaSourcePage: 233,
            necaSourceUnit: "C",
            necaNormal: 0.25,
            necaDifficult: 0.3125,
            necaVeryDifficult: 0.375,
            necaVerified: true,
          } : {}),
        };
      }),
    });
  }

  const factorCount = await tx.marketFactor.count({ where: { organizationId } });
  if (factorCount === 0) {
    await tx.marketFactor.createMany({
      data: DEFAULT_MARKET_FACTORS.map((f) => ({
        organizationId,
        category: f.category,
        description: f.description,
        direction: f.direction,
        magnitude: f.magnitude,
        affects: f.affects,
        source: f.source,
        url: f.url,
        asOf: new Date(`${f.asOf}T00:00:00Z`),
      })),
    });
  }
}
