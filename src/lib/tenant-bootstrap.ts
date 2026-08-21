import type { Prisma } from "@prisma/client";
import { DEFAULT_COST_ITEMS, DEFAULT_MARKET_FACTORS } from "./costing-data";

/** Seed estimating defaults into one account/tenant inside an organization. */
export async function bootstrapOrganization(
  tx: Prisma.TransactionClient,
  organizationId: string,
  accountId?: string,
) {
  let account = accountId
    ? await tx.account.findFirst({ where: { id: accountId, organizationId } })
    : await tx.account.findFirst({ where: { organizationId, slug: "main" }, orderBy: { createdAt: "asc" } });

  if (!account) {
    account = await tx.account.create({
      data: { organizationId, name: "Main Account", slug: "main" },
    });
  }

  await tx.costSettings.upsert({
    where: { accountId: account.id },
    update: {},
    create: {
      organizationId,
      accountId: account.id,
      laborRate: 95,
      overheadPercent: 12,
      profitMarginPercent: 15,
      difficultyMultiplier: 1,
      defaultCondition: "NORMAL",
    },
  });

  const existingItems = await tx.costItem.count({ where: { accountId: account.id } });
  if (existingItems === 0) {
    await tx.costItem.createMany({
      data: DEFAULT_COST_ITEMS.map((item) => {
        const isVerifiedDuplex = item.description === "Duplex Receptacle, 15A, 3-wire, straight blade";
        return {
          organizationId,
          accountId: account.id,
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

  const factorCount = await tx.marketFactor.count({ where: { accountId: account.id } });
  if (factorCount === 0) {
    await tx.marketFactor.createMany({
      data: DEFAULT_MARKET_FACTORS.map((factor) => ({
        organizationId,
        accountId: account.id,
        category: factor.category,
        description: factor.description,
        direction: factor.direction,
        magnitude: factor.magnitude,
        affects: factor.affects,
        source: factor.source,
        url: factor.url,
        asOf: new Date(`${factor.asOf}T00:00:00Z`),
      })),
    });
  }

  return account;
}
