import { Role, SystemRole } from "@prisma/client";

const RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function atLeast(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export const can = {
  viewProject: (role: Role) => atLeast(role, "VIEWER"),
  createRfi: (role: Role) => atLeast(role, "MEMBER"),
  editAnyRfi: (role: Role) => atLeast(role, "ADMIN"),
  deleteRfi: (role: Role) => atLeast(role, "ADMIN"),
  manageProjects: (role: Role) => atLeast(role, "ADMIN"),
  manageMembers: (role: Role) => atLeast(role, "ADMIN"),
  changeRoleTo: (actorRole: Role, targetRole: Role) =>
    targetRole === "OWNER" ? actorRole === "OWNER" : atLeast(actorRole, "ADMIN"),
  removeMember: (actorRole: Role, targetRole: Role) =>
    targetRole === "OWNER" ? false : atLeast(actorRole, "ADMIN"),
  viewAuditLog: (role: Role) => atLeast(role, "ADMIN"),
  manageOrgSettings: (role: Role) => role === "OWNER",
  manageSuppliers: (role: Role) => atLeast(role, "ADMIN"),
  importTakeoff: (role: Role) => atLeast(role, "MEMBER"),
  createRfq: (role: Role) => atLeast(role, "MEMBER"),
  sendRfq: (role: Role) => atLeast(role, "MEMBER"),
  deleteRfq: (role: Role) => atLeast(role, "ADMIN"),
  viewCosting: (role: Role) => atLeast(role, "VIEWER"),
  createEstimate: (role: Role) => atLeast(role, "MEMBER"),
  editEstimate: (role: Role) => atLeast(role, "MEMBER"),
  deleteEstimate: (role: Role) => atLeast(role, "ADMIN"),
  logJobCost: (role: Role) => atLeast(role, "MEMBER"),
  logSupplierQuote: (role: Role) => atLeast(role, "MEMBER"),
  manageCostCatalog: (role: Role) => atLeast(role, "ADMIN"),
  manageCostSettings: (role: Role) => atLeast(role, "ADMIN"),
  manageMarketFactors: (role: Role) => atLeast(role, "ADMIN"),
  platformAdmin: (systemRole: SystemRole) => systemRole === "SUPER_ADMIN",
};

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
