import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tenant context never auto-creates account membership", async () => {
  const source = await read("src/lib/session.ts");
  const start = source.indexOf("export async function requireTenantContext");
  assert.ok(start >= 0, "requireTenantContext must exist");
  const body = source.slice(start, start + 5000);
  assert.doesNotMatch(body, /accountMembership\.(create|upsert)/, "tenant reads must not grant membership");
});

test("member invitations are account-targeted and require tenant context", async () => {
  const source = await read("src/app/(app)/admin/actions.ts");
  const start = source.indexOf("export async function inviteMemberAction");
  const end = source.indexOf("export async function updateMemberRoleAction");
  const body = source.slice(start, end);
  assert.match(body, /requireTenantContext\(\)/);
  assert.match(body, /accountMembership\.upsert/);
  assert.match(body, /"accountId"/);
});

test("custom estimate lines require member role", async () => {
  const source = await read("src/app/(app)/costing/actions.ts");
  const helperStart = source.indexOf("async function requireEstimate");
  const helperEnd = source.indexOf("export async function addEstimateLineAction");
  assert.match(source.slice(helperStart, helperEnd), /requireAccountRole\("MEMBER"\)/);
  const actionStart = source.indexOf("export async function addCustomEstimateLineAction");
  const actionEnd = source.indexOf("export async function updateEstimateLineAction");
  assert.match(source.slice(actionStart, actionEnd), /requireEstimate\(estimateId\)/);
});

test("estimate lifecycle includes approved and superseded controlled states", async () => {
  const schema = await read("prisma/schema.prisma");
  const enumStart = schema.indexOf("enum EstimateStatus");
  const enumEnd = schema.indexOf("enum EstimateCondition");
  const statusEnum = schema.slice(enumStart, enumEnd);
  assert.match(statusEnum, /APPROVED/);
  assert.match(statusEnum, /SUPERSEDED/);
  const statusMigration = await read("prisma/migrations/202609042135_estimate_workflow_statuses/migration.sql");
  const guardMigration = await read("prisma/migrations/202609042140_controlled_estimate_workflow_guards/migration.sql");
  assert.match(statusMigration, /APPROVED/);
  assert.match(statusMigration, /SUPERSEDED/);
  assert.match(guardMigration, /APPROVED/);
  assert.match(guardMigration, /SUPERSEDED/);
  assert.match(guardMigration, /protect_controlled_estimate_children/);
});

test("RFQ creation uses direct estimate-line identity", async () => {
  const source = await read("src/app/(app)/costing/estimates/[estimateId]/rfq/actions.ts");
  assert.match(source, /randomUUID\(\)/);
  assert.match(source, /rfqLineId/);
  assert.match(source, /estimateLineId/);
  assert.match(source, /linkRfqLineToEstimateLine\(ctx\.account\.id,\s*rfqLineId,\s*estimateLineId\)/);
  assert.doesNotMatch(source, /line\.description === rfqLine\.description/);
});

test("Plan Room mutations validate account and project scope", async () => {
  const source = await read("src/app/(app)/projects/[projectId]/plan-room/actions.ts");
  assert.match(source, /accountId/);
  assert.match(source, /projectId/);
  assert.match(source, /parentId|folderId|documentId/);
});
