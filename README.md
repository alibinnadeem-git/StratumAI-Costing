# Stratum AI — Costing + Project Operations

A merged multi-tenant platform combining the **Stratum AI Costing Tool** with the uploaded **Stratum RFI / Takeoff / RFQ** application.

Stack: **Next.js 15 · TypeScript strict · Prisma · Neon Postgres · NextAuth · Tailwind · React PDF · Resend**.

## What is merged

### Estimating / Costing
- Organization-scoped item database seeded from the prior Stratum AI Costing Tool (74 working catalog items).
- Conservative **58-row source-checked NECA labor library** from the user-supplied 2009–2010 MLU scan.
- Normal / Difficult / Very Difficult labor tiers.
- Estimate builder with organization defaults, estimate-specific overrides, line-item snapshots, adders, overhead and profit.
- Optional project linkage and **Import latest Bluebeam takeoff** into an estimate.
- Job-cost actuals with Admin/Owner calibration back into the item database.
- Supplier quote history with Admin/Owner material-price calibration.
- Market intelligence signals kept separate from automatic rate changes.
- Cost settings per organization: labor rate, overhead, profit, difficulty multiplier and default condition.

### Project Operations (from the RFI application)
- Projects.
- RFI log, screenshots, status, responses, PDF export and email.
- Bluebeam Markups List import.
- Supplier directory.
- RFQ builder, supplier-specific PDFs and email delivery.
- Audit trail.

## Multi-tenant / multi-organization architecture

The platform uses one database with hard tenant boundaries:

- `Membership` allows one user to belong to multiple organizations with a different role in each.
- Active organization is selected by an **httpOnly cookie** and resolved server-side in `src/lib/session.ts`.
- Tenant-owned rows carry `organizationId` directly, or are nested under a tenant-owned `Project`.
- Server actions always resolve the active organization before reading or writing data.
- An organization switcher changes the full data context for Costing, Projects, Suppliers, RFIs, RFQs, Estimates, Job Costs, Quotes, Market Intelligence and Admin.
- `/organizations` lets an existing user create additional isolated organizations and switch between memberships.
- New organizations automatically receive their own cost settings, default item catalog and market-signal baseline.
- Existing organizations are lazily bootstrapped once after upgrade if they pre-date the costing module.

### Roles

`OWNER > ADMIN > MEMBER > VIEWER`

- VIEWER: read tenant data and exports.
- MEMBER: day-to-day RFI/RFQ and estimating workflows.
- ADMIN: member management, supplier management, cost catalog, NECA import, calibration, market factors and estimate deletion.
- OWNER: organization identity and owner-level access.

A separate `User.systemRole = SUPER_ADMIN` supports a cross-tenant platform dashboard at `/admin/platform`. Normal organization Admins never get cross-tenant visibility.

## Admin dashboards

`/admin` is now an organization-wide Admin Dashboard with:
- members
- active projects
- RFI / RFQ counts
- supplier count
- cost-item count
- estimate count and estimate pipeline value
- recent tenant audit activity

Additional Admin pages:
- `/admin/members`
- `/admin/organization`
- `/admin/audit`
- `/admin/platform` (SUPER_ADMIN only)

## Main routes

- `/dashboard` — combined operations + estimating dashboard
- `/costing` — costing overview
- `/costing/items`
- `/costing/estimates`
- `/costing/job-costs`
- `/costing/quotes`
- `/costing/neca`
- `/costing/market`
- `/costing/settings`
- `/projects`
- `/suppliers`
- `/organizations`
- `/admin`

## Production database

The production schema is designed for Neon Postgres. A dedicated database named `stratum_ai_costing` can be used inside the selected Neon project so the costing suite remains isolated from other Stratum applications sharing the same Neon account.

The checked-in schema lives at `prisma/schema.prisma`. `prisma/initial-neon-schema.sql` is the reviewed initial schema snapshot used for a fresh production database.

For subsequent schema changes, create and review a Prisma migration rather than using `db push` against production.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

The seed command creates demo users and should be used only in local/test environments. **Do not run `npm run db:seed` against production.** Production onboarding starts from the registration flow, which creates the first user as Organization OWNER and bootstraps that organization’s costing catalog/settings.

## Important NECA data note

The embedded NECA library is deliberately conservative. It contains only the rows retained after source-page QA from the user-supplied 2009–2010 scan. Uncertain OCR rows were excluded rather than silently corrected. The newer 2023–2024 file supplied alongside it is an alphabetical index, not the underlying labor-rate tables, so it is not treated as a rate source.

## Vercel production settings

Set these environment variables in the Vercel project for Production (and Preview where appropriate):

- `DATABASE_URL` — pooled Neon connection for `stratum_ai_costing`
- `DIRECT_URL` — direct Neon connection for `stratum_ai_costing`
- `AUTH_SECRET` — long random secret
- `AUTH_TRUST_HOST=true`
- `RESEND_API_KEY` — optional until outbound email is enabled
- `EMAIL_FROM` — verified sender when Resend is enabled

The app build command already runs `prisma generate && next build`. Do not store real secrets in Git.
