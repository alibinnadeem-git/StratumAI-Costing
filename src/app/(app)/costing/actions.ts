"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdderBasis, AdderType, CostSource, EstimateCondition, EstimateStatus, MarketAffects, MarketDirection } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAccountRole } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { NECA_RATES } from "@/lib/costing-data";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string, fallback = 0) => {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? n : fallback;
};
const dateOrNull = (value: string) => value ? new Date(`${value}T00:00:00`) : null;

function necaUnitToToolUnit(unit: string) {
  if (unit === "E") return "EA";
  return unit || "EA";
}

export async function saveCostSettingsAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  await db.costSettings.upsert({
    where: { accountId: ctx.account.id },
    update: {
      laborRate: num(formData, "laborRate", 95),
      overheadPercent: num(formData, "overheadPercent", 12),
      profitMarginPercent: num(formData, "profitMarginPercent", 15),
      difficultyMultiplier: num(formData, "difficultyMultiplier", 1),
      defaultCondition: str(formData, "defaultCondition") as EstimateCondition,
    },
    create: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      laborRate: num(formData, "laborRate", 95),
      overheadPercent: num(formData, "overheadPercent", 12),
      profitMarginPercent: num(formData, "profitMarginPercent", 15),
      difficultyMultiplier: num(formData, "difficultyMultiplier", 1),
      defaultCondition: str(formData, "defaultCondition") as EstimateCondition,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.settings.update", detail: "Updated account estimating defaults" });
  revalidatePath("/costing");
  revalidatePath("/costing/settings");
}

export async function createCostItemAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const description = str(formData, "description");
  if (!description) return;
  await db.costItem.create({
    data: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      category: str(formData, "category") || "Uncategorized",
      description,
      unit: str(formData, "unit") || "EA",
      laborHoursPerUnit: num(formData, "laborHoursPerUnit"),
      materialCost: num(formData, "materialCost"),
      source: (str(formData, "source") || "MANUAL") as CostSource,
      notes: str(formData, "notes") || null,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.item.create", detail: `Created cost item: ${description}` });
  revalidatePath("/costing/items");
}

export async function updateCostItemAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const id = str(formData, "id");
  const item = await db.costItem.findFirst({ where: { id, accountId: ctx.account.id } });
  if (!item) throw new Error("Cost item not found in this account.");
  await db.costItem.update({
    where: { id },
    data: {
      category: str(formData, "category") || item.category,
      description: str(formData, "description") || item.description,
      unit: str(formData, "unit") || item.unit,
      laborHoursPerUnit: num(formData, "laborHoursPerUnit", item.laborHoursPerUnit),
      materialCost: num(formData, "materialCost", item.materialCost),
      source: (str(formData, "source") || item.source) as CostSource,
      notes: str(formData, "notes") || null,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.item.update", detail: `Updated cost item: ${item.description}` });
  revalidatePath("/costing/items");
}

export async function deleteCostItemAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const id = str(formData, "id");
  const item = await db.costItem.findFirst({ where: { id, accountId: ctx.account.id } });
  if (!item) return;
  await db.costItem.delete({ where: { id } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.item.delete", detail: `Deleted cost item: ${item.description}` });
  revalidatePath("/costing/items");
}

export async function importNecaRateAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const index = Number(str(formData, "index"));
  const condition = (str(formData, "condition") || "NORMAL") as EstimateCondition;
  const r = NECA_RATES[index];
  if (!r) throw new Error("NECA row not found.");
  const workingRate = condition === "DIFFICULT" ? r.difficult : condition === "VERY_DIFFICULT" ? r.veryDifficult : r.normal;
  const unit = necaUnitToToolUnit(r.unit);
  const existing = await db.costItem.findFirst({
    where: { accountId: ctx.account.id, necaSourcePage: r.sourcePage, description: r.description },
  });
  if (existing) {
    await db.costItem.update({
      where: { id: existing.id },
      data: {
        unit,
        laborHoursPerUnit: workingRate,
        source: "NECA",
        necaSourcePage: r.sourcePage,
        necaSourceUnit: r.unit,
        necaNormal: r.normal,
        necaDifficult: r.difficult,
        necaVeryDifficult: r.veryDifficult,
        necaVerified: true,
        notes: `Source-checked NECA MLU ${r.sourcePage}; ${condition.replaceAll("_", " ")} working rate selected.`,
      },
    });
  } else {
    await db.costItem.create({
      data: {
        organizationId: ctx.organization.id,
        accountId: ctx.account.id,
        category: "NECA Imported",
        description: r.description,
        unit,
        laborHoursPerUnit: workingRate,
        materialCost: 0,
        source: "NECA",
        necaSourcePage: r.sourcePage,
        necaSourceUnit: r.unit,
        necaNormal: r.normal,
        necaDifficult: r.difficult,
        necaVeryDifficult: r.veryDifficult,
        necaVerified: true,
        notes: `Source-checked NECA MLU ${r.sourcePage}; ${condition.replaceAll("_", " ")} working rate selected.`,
      },
    });
  }
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.neca.import", detail: `Imported verified NECA rate: ${r.description}` });
  revalidatePath("/costing/items");
  revalidatePath("/costing/neca");
}

export async function createEstimateAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const name = str(formData, "name");
  if (!name) throw new Error("Estimate name is required.");
  const projectIdRaw = str(formData, "projectId");
  let projectId: string | null = null;
  if (projectIdRaw) {
    const project = await db.project.findFirst({ where: { id: projectIdRaw, accountId: ctx.account.id } });
    if (!project) throw new Error("Project not found in this account.");
    projectId = project.id;
  }
  const settings = await db.costSettings.findUnique({ where: { accountId: ctx.account.id } });
  const estimate = await db.$transaction(async (tx) => {
    const max = await tx.costEstimate.aggregate({ where: { accountId: ctx.account.id }, _max: { number: true } });
    return tx.costEstimate.create({
      data: {
        organizationId: ctx.organization.id,
        accountId: ctx.account.id,
        projectId,
        number: (max._max.number ?? 0) + 1,
        name,
        condition: settings?.defaultCondition ?? "NORMAL",
        laborRate: settings?.laborRate ?? 95,
        overheadPercent: settings?.overheadPercent ?? 12,
        profitMarginPercent: settings?.profitMarginPercent ?? 15,
        difficultyMultiplier: settings?.difficultyMultiplier ?? 1,
        createdById: ctx.user.id,
        notes: str(formData, "notes") || null,
      },
    });
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "cost.estimate.create", detail: `Created estimate #${estimate.number}: ${estimate.name}` });
  redirect(`/costing/estimates/${estimate.id}`);
}

export async function updateEstimateAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const id = str(formData, "id");
  const estimate = await db.costEstimate.findFirst({ where: { id, accountId: ctx.account.id } });
  if (!estimate) throw new Error("Estimate not found.");
  const projectIdRaw = str(formData, "projectId");
  let projectId: string | null = null;
  if (projectIdRaw) {
    const project = await db.project.findFirst({ where: { id: projectIdRaw, accountId: ctx.account.id } });
    if (!project) throw new Error("Project not found in this account.");
    projectId = project.id;
  }
  await db.costEstimate.update({
    where: { id },
    data: {
      name: str(formData, "name") || estimate.name,
      status: (str(formData, "status") || estimate.status) as EstimateStatus,
      condition: (str(formData, "condition") || estimate.condition) as EstimateCondition,
      laborRate: num(formData, "laborRate", estimate.laborRate),
      overheadPercent: num(formData, "overheadPercent", estimate.overheadPercent),
      profitMarginPercent: num(formData, "profitMarginPercent", estimate.profitMarginPercent),
      difficultyMultiplier: num(formData, "difficultyMultiplier", estimate.difficultyMultiplier),
      projectId,
      notes: str(formData, "notes") || null,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "cost.estimate.update", detail: `Updated estimate #${estimate.number}: ${estimate.name}` });
  revalidatePath(`/costing/estimates/${id}`);
  revalidatePath("/costing/estimates");
}

export async function deleteEstimateAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const id = str(formData, "id");
  const estimate = await db.costEstimate.findFirst({ where: { id, accountId: ctx.account.id } });
  if (!estimate) return;
  await db.costEstimate.delete({ where: { id } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId: estimate.projectId, action: "cost.estimate.delete", detail: `Deleted estimate #${estimate.number}: ${estimate.name}` });
  redirect("/costing/estimates");
}

async function requireEstimate(estimateId: string) {
  const ctx = await requireAccountRole("MEMBER");
  const estimate = await db.costEstimate.findFirst({ where: { id: estimateId, accountId: ctx.account.id } });
  if (!estimate) throw new Error("Estimate not found.");
  return { ctx, estimate };
}

export async function addEstimateLineAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const estimateId = str(formData, "estimateId");
  const costItemId = str(formData, "costItemId");
  const quantity = Math.max(0, num(formData, "quantity", 1));
  const [estimate, item] = await Promise.all([
    db.costEstimate.findFirst({ where: { id: estimateId, accountId: ctx.account.id } }),
    db.costItem.findFirst({ where: { id: costItemId, accountId: ctx.account.id } }),
  ]);
  if (!estimate || !item) throw new Error("Estimate or cost item not found.");
  const count = await db.estimateLineItem.count({ where: { estimateId } });
  const line=await db.estimateLineItem.create({
    data: {
      estimateId,
      costItemId,
      description: item.description,
      category: item.category,
      quantity,
      unit: item.unit,
      materialCost: item.materialCost,
      laborHoursPerUnit: item.laborHoursPerUnit,
      laborNormal: item.necaNormal,
      laborDifficult: item.necaDifficult,
      laborVeryDifficult: item.necaVeryDifficult,
      notes: item.notes,
      sortOrder: count,
    },
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:estimate.projectId,action:"cost.estimate.line.create",detail:`Added estimate line ${line.description} to estimate #${estimate.number}`});
  revalidatePath(`/costing/estimates/${estimateId}`);
}

export async function addCustomEstimateLineAction(formData: FormData) {
  const estimateId = str(formData, "estimateId");
  const { ctx, estimate } = await requireEstimate(estimateId);
  const count = await db.estimateLineItem.count({ where: { estimateId } });
  const line=await db.estimateLineItem.create({
    data: {
      estimateId: estimate.id,
      description: str(formData, "description") || "Custom line",
      category: str(formData, "category") || null,
      quantity: Math.max(0, num(formData, "quantity", 1)),
      unit: str(formData, "unit") || "EA",
      materialCost: Math.max(0, num(formData, "materialCost", 0)),
      laborHoursPerUnit: Math.max(0, num(formData, "laborHoursPerUnit", 0)),
      notes: str(formData, "notes") || null,
      sortOrder: count,
    },
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:estimate.projectId,action:"cost.estimate.line.create",detail:`Added custom estimate line ${line.description} to estimate #${estimate.number}`});
  revalidatePath(`/costing/estimates/${estimateId}`);
}

export async function updateEstimateLineAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const id = str(formData, "id");
  const line = await db.estimateLineItem.findFirst({ where: { id, estimate: { accountId: ctx.account.id } }, include: { estimate: true } });
  if (!line) throw new Error("Estimate line not found.");
  await db.estimateLineItem.update({
    where: { id },
    data: {
      description: str(formData, "description") || line.description,
      quantity: Math.max(0, num(formData, "quantity", line.quantity)),
      unit: str(formData, "unit") || line.unit,
      materialCost: Math.max(0, num(formData, "materialCost", line.materialCost)),
      laborHoursPerUnit: Math.max(0, num(formData, "laborHoursPerUnit", line.laborHoursPerUnit)),
    },
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:line.estimate.projectId,action:"cost.estimate.line.update",detail:`Updated estimate line ${line.description} on estimate #${line.estimate.number}`});
  revalidatePath(`/costing/estimates/${line.estimateId}`);
}

export async function deleteEstimateLineAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const id = str(formData, "id");
  const line = await db.estimateLineItem.findFirst({ where: { id, estimate: { accountId: ctx.account.id } },include:{estimate:true} });
  if (!line) return;
  await db.estimateLineItem.delete({ where: { id } });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:line.estimate.projectId,action:"cost.estimate.line.delete",detail:`Deleted estimate line ${line.description} from estimate #${line.estimate.number}`});
  revalidatePath(`/costing/estimates/${line.estimateId}`);
}

export async function importLatestTakeoffAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const estimateId = str(formData, "estimateId");
  const estimate = await db.costEstimate.findFirst({ where: { id: estimateId, accountId: ctx.account.id } });
  if (!estimate?.projectId) throw new Error("Link the estimate to a project before importing a takeoff.");
  const latest = await db.takeoffImport.findFirst({ where: { projectId: estimate.projectId }, include: { items: true }, orderBy: { importedAt: "desc" } });
  if (!latest) throw new Error("No takeoff import exists for this project.");
  const count = await db.estimateLineItem.count({ where: { estimateId } });
  await db.estimateLineItem.createMany({
    data: latest.items.map((item, i) => ({
      estimateId,
      description: item.description || item.subject,
      category: "Bluebeam Takeoff",
      quantity: item.count ?? 1,
      unit: item.unit || "EA",
      materialCost: 0,
      laborHoursPerUnit: 0,
      notes: `Imported from ${latest.fileName || "Bluebeam takeoff"}. Map this line to a cost item or enter labor/material manually.`,
      sortOrder: count + i,
    })),
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId: estimate.projectId, action: "cost.takeoff.import", detail: `Imported ${latest.items.length} takeoff rows into estimate #${estimate.number}` });
  revalidatePath(`/costing/estimates/${estimateId}`);
}

export async function addEstimateAdderAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const estimateId = str(formData, "estimateId");
  const estimate = await db.costEstimate.findFirst({ where: { id: estimateId, accountId: ctx.account.id } });
  if (!estimate) throw new Error("Estimate not found.");
  const adder=await db.estimateAdder.create({
    data: {
      estimateId,
      name: str(formData, "name") || "Additional cost",
      type: (str(formData, "type") || "PERCENT") as AdderType,
      appliesTo: (str(formData, "appliesTo") || "DIRECT_COST") as AdderBasis,
      amount: num(formData, "amount", 0),
    },
  });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:estimate.projectId,action:"cost.estimate.adder.create",detail:`Added estimate adder ${adder.name} to estimate #${estimate.number}`});
  revalidatePath(`/costing/estimates/${estimateId}`);
}

export async function deleteEstimateAdderAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const id = str(formData, "id");
  const adder = await db.estimateAdder.findFirst({ where: { id, estimate: { accountId: ctx.account.id } },include:{estimate:true} });
  if (!adder) return;
  await db.estimateAdder.delete({ where: { id } });
  await logAction({organizationId:ctx.organization.id,accountId:ctx.account.id,userId:ctx.user.id,projectId:adder.estimate.projectId,action:"cost.estimate.adder.delete",detail:`Deleted estimate adder ${adder.name} from estimate #${adder.estimate.number}`});
  revalidatePath(`/costing/estimates/${adder.estimateId}`);
}

export async function createJobCostAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const costItemId = str(formData, "costItemId") || null;
  const projectId = str(formData, "projectId") || null;
  if (costItemId && !(await db.costItem.findFirst({ where: { id: costItemId, accountId: ctx.account.id } }))) throw new Error("Cost item not found.");
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } }))) throw new Error("Project not found.");
  const entry = await db.jobCostEntry.create({
    data: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      costItemId,
      projectId,
      createdById: ctx.user.id,
      jobName: str(formData, "jobName") || "Completed work",
      quantity: Math.max(0.0001, num(formData, "quantity", 1)),
      actualLaborHours: Math.max(0, num(formData, "actualLaborHours", 0)),
      actualMaterialCost: Math.max(0, num(formData, "actualMaterialCost", 0)),
      date: dateOrNull(str(formData, "date")) ?? new Date(),
      notes: str(formData, "notes") || null,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "cost.job_actual.create", detail: `Logged job cost: ${entry.jobName}` });
  revalidatePath("/costing/job-costs");
}

export async function applyJobCostToItemAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const entryId = str(formData, "entryId");
  const entry = await db.jobCostEntry.findFirst({ where: { id: entryId, accountId: ctx.account.id } });
  if (!entry?.costItemId || entry.quantity <= 0) return;
  const item = await db.costItem.findFirst({ where: { id: entry.costItemId, accountId: ctx.account.id } });
  if (!item) return;
  await db.costItem.update({
    where: { id: item.id },
    data: {
      laborHoursPerUnit: entry.actualLaborHours / entry.quantity,
      materialCost: entry.actualMaterialCost / entry.quantity,
      source: "HIST",
      notes: `Calibrated from job cost actual: ${entry.jobName} (${entry.date.toISOString().slice(0,10)}).`,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.item.calibrate.history", detail: `Applied job actual to ${item.description}` });
  revalidatePath("/costing/job-costs");
  revalidatePath("/costing/items");
}

export async function createSupplierQuoteAction(formData: FormData) {
  const ctx = await requireAccountRole("MEMBER");
  const supplierId = str(formData, "supplierId") || null;
  const costItemId = str(formData, "costItemId") || null;
  const projectId = str(formData, "projectId") || null;
  if (supplierId && !(await db.supplier.findFirst({ where: { id: supplierId, accountId: ctx.account.id } }))) throw new Error("Supplier not found.");
  if (costItemId && !(await db.costItem.findFirst({ where: { id: costItemId, accountId: ctx.account.id } }))) throw new Error("Cost item not found.");
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, accountId: ctx.account.id } }))) throw new Error("Project not found.");
  const quote = await db.supplierQuote.create({
    data: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      supplierId,
      costItemId,
      projectId,
      createdById: ctx.user.id,
      description: str(formData, "description") || "Supplier quote",
      quantity: Math.max(0.0001, num(formData, "quantity", 1)),
      unit: str(formData, "unit") || "EA",
      unitMaterialCost: Math.max(0, num(formData, "unitMaterialCost", 0)),
      quoteDate: dateOrNull(str(formData, "quoteDate")) ?? new Date(),
      validUntil: dateOrNull(str(formData, "validUntil")),
      reference: str(formData, "reference") || null,
      notes: str(formData, "notes") || null,
    },
  });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, projectId, action: "cost.quote.create", detail: `Logged supplier quote: ${quote.description}` });
  revalidatePath("/costing/quotes");
}

export async function applyQuoteToItemAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const quoteId = str(formData, "quoteId");
  const quote = await db.supplierQuote.findFirst({ where: { id: quoteId, accountId: ctx.account.id } });
  if (!quote?.costItemId) return;
  const item = await db.costItem.findFirst({ where: { id: quote.costItemId, accountId: ctx.account.id } });
  if (!item) return;
  await db.costItem.update({ where: { id: item.id }, data: { materialCost: quote.unitMaterialCost, source: "QUOTE", notes: `Material price updated from supplier quote ${quote.reference || quote.description} dated ${quote.quoteDate.toISOString().slice(0,10)}.` } });
  await logAction({ organizationId: ctx.organization.id, accountId: ctx.account.id, userId: ctx.user.id, action: "cost.item.calibrate.quote", detail: `Applied supplier quote to ${item.description}` });
  revalidatePath("/costing/quotes");
  revalidatePath("/costing/items");
}

export async function createMarketFactorAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const description = str(formData, "description");
  if (!description) return;
  await db.marketFactor.create({
    data: {
      organizationId: ctx.organization.id,
      accountId: ctx.account.id,
      category: str(formData, "category") || "Market",
      description,
      direction: (str(formData, "direction") || "INCREASE") as MarketDirection,
      magnitude: num(formData, "magnitude", 0),
      affects: (str(formData, "affects") || "ALL") as MarketAffects,
      source: str(formData, "source") || null,
      url: str(formData, "url") || null,
      asOf: dateOrNull(str(formData, "asOf")),
      notes: str(formData, "notes") || null,
    },
  });
  revalidatePath("/costing/market");
}

export async function deleteMarketFactorAction(formData: FormData) {
  const ctx = await requireAccountRole("ADMIN");
  const id = str(formData, "id");
  await db.marketFactor.deleteMany({ where: { id, accountId: ctx.account.id } });
  revalidatePath("/costing/market");
}
