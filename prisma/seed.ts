// Creates one demo organization with an OWNER, ADMIN, and MEMBER user, plus
// a Main Account tenant and sample project data. Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapOrganization } from "../src/lib/tenant-bootstrap";

const db = new PrismaClient();

async function main() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_PASSWORD must be set before running the local/test seed.");
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const org = await db.organization.upsert({
    where: { slug: "stratum-electric" },
    update: {},
    create: { name: "Stratum Electric", slug: "stratum-electric" },
  });

  const users = await Promise.all([
    db.user.upsert({ where: { email: "owner@stratum.demo" }, update: { systemRole: "SUPER_ADMIN" }, create: { email: "owner@stratum.demo", name: "Ali (Owner)", passwordHash, systemRole: "SUPER_ADMIN" } }),
    db.user.upsert({ where: { email: "admin@stratum.demo" }, update: {}, create: { email: "admin@stratum.demo", name: "Hammad (Admin)", passwordHash } }),
    db.user.upsert({ where: { email: "member@stratum.demo" }, update: {}, create: { email: "member@stratum.demo", name: "Field Engineer", passwordHash } }),
  ]);

  const roles = ["OWNER", "ADMIN", "MEMBER"] as const;
  for (let i = 0; i < users.length; i++) {
    await db.membership.upsert({
      where: { userId_organizationId: { userId: users[i]!.id, organizationId: org.id } },
      update: {},
      create: { userId: users[i]!.id, organizationId: org.id, role: roles[i]! },
    });
  }

  const account = await db.$transaction(async (tx) => bootstrapOrganization(tx, org.id));

  for (let i = 0; i < users.length; i++) {
    await db.accountMembership.upsert({
      where: { userId_accountId: { userId: users[i]!.id, accountId: account.id } },
      update: { role: roles[i]! },
      create: { userId: users[i]!.id, accountId: account.id, role: roles[i]! },
    });
  }

  const project = await db.project.upsert({
    where: { id: "seed-project-terawatt" },
    update: { accountId: account.id, organizationId: org.id },
    create: { id: "seed-project-terawatt", name: "Terawatt — Fremont Service Center", number: "24-118", organizationId: org.id, accountId: account.id },
  });

  await db.rfi.upsert({
    where: { projectId_number: { projectId: project.id, number: 1 } },
    update: {},
    create: {
      projectId: project.id,
      number: 1,
      sheet: "E2.03",
      location: "Service Advisors — 111",
      subject: "Cannot locate Panel H1",
      question: "Panel H1 is referenced on circuit H1-24 (1) but is not shown on the panel schedule or single-line diagram. Please advise panel location and confirm feed.",
      status: "OPEN",
      priority: "HIGH",
      submittedBy: "Field Engineer",
      dateSubmitted: new Date(),
      createdById: users[2]!.id,
    },
  });

  const graybar = await db.supplier.upsert({
    where: { id: "seed-supplier-graybar" },
    update: { accountId: account.id, organizationId: org.id },
    create: { id: "seed-supplier-graybar", organizationId: org.id, accountId: account.id, name: "Graybar", contactName: "Jordan Reyes", email: "quotes@graybar-demo.example", categories: ["lighting", "devices"] },
  });
  const crescoElectrical = await db.supplier.upsert({
    where: { id: "seed-supplier-cresco" },
    update: { accountId: account.id, organizationId: org.id },
    create: { id: "seed-supplier-cresco", organizationId: org.id, accountId: account.id, name: "Cresco Electrical Supply", contactName: "Priya Nair", email: "estimating@cresco-demo.example", categories: ["conduit", "gear"] },
  });

  const takeoff = await db.takeoffImport.upsert({
    where: { id: "seed-takeoff-1" },
    update: {},
    create: {
      id: "seed-takeoff-1",
      projectId: project.id,
      fileName: "marked esheets 23-5039 Audi Pacific (Binder).csv",
      importedById: users[2]!.id,
      items: {
        create: [
          { subject: "Type A", count: 170, unit: "EA", description: "Type A — LED downlight fixture" },
          { subject: "Type B", count: 205, unit: "EA", description: "Type B — 2x4 troffer fixture" },
          { subject: "Type C", count: 8, unit: "EA", description: "Type C — emergency egress fixture" },
        ],
      },
    },
    include: { items: true },
  });

  await db.rfq.upsert({
    where: { projectId_number: { projectId: project.id, number: 1 } },
    update: {},
    create: {
      projectId: project.id,
      number: 1,
      title: "Lighting fixture package — Types A/B/C",
      status: "DRAFT",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: "Deliver to jobsite laydown, coordinate with GC schedule.",
      createdById: users[2]!.id,
      lineItems: {
        create: takeoff.items.map((item) => ({
          description: item.description ?? item.subject,
          quantity: item.count ?? 1,
          unit: item.unit ?? "EA",
          takeoffItemId: item.id,
        })),
      },
      recipients: { create: [{ supplierId: graybar.id }, { supplierId: crescoElectrical.id }] },
    },
  });

  console.log("Seeded Stratum Electric with Main Account tenant and owner/admin/member demo logins.");
}

main().finally(() => db.$disconnect());
