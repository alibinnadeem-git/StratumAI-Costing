# Stratum AI Costing — Canonical Product Architecture

This document is the implementation source of truth for the post-login product.

## Product shell

The uploaded Stratum AI Costing Tool experience remains the primary product shell. The dark engineering grid, copper/cyan accents, compact technical navigation, Item Database, Estimate Builder, Job Cost History, Supplier Quotes, Analytics, Market Intelligence, NECA Labor Library and Settings are the base experience. Project Operations and enterprise capabilities are inserted into this shell; the costing UI is not inserted into a generic SaaS shell.

## Ownership hierarchy

```text
MULTI-ORG PLATFORM
└── Organization
    └── Account / Tenant
        ├── Users + account memberships
        ├── Projects
        ├── Cost Items
        ├── Estimates
        ├── Estimate Lines + Adders
        ├── Job Costs
        ├── Suppliers + Contacts
        ├── Supplier Quotes
        ├── Takeoffs
        ├── RFIs
        ├── RFQs + Recipients + Line Items
        ├── Market Intelligence
        ├── Documents + Attachments
        ├── Notes + Comments
        ├── Audit
        ├── Automations
        ├── Settings
        └── Jarvis AI Context
```

A business record must never be readable or mutable merely because a user is authenticated. The server must verify platform, organization and active account/tenant context before access.

## RBAC

Three levels may coexist:

1. Platform role — e.g. `SUPER_ADMIN`.
2. Organization membership role — who can manage the organization and its accounts.
3. Account/Tenant membership role — who can read or operate within a specific workspace.

Jarvis uses the same RBAC functions as the normal UI. AI is never an authorization bypass.

## Full CRUD standard

Every meaningful domain object must support its applicable form of:

- Create
- Read/detail
- Update
- Delete or protected delete
- Archive / soft delete
- Restore
- Duplicate / clone
- Search
- Sort
- Filter
- Bulk select and bulk actions
- Relationships to parent/child records
- Tags / status / custom fields where relevant
- Notes / comments / attachments where relevant
- Created by / updated by
- Created at / updated at
- Record history
- Audit trail
- Export and import where useful
- Tenant scoping
- Server-side RBAC
- AI-readable context

No object should have a UI-only permission rule without an equivalent server-side check.

## Core domains

### Costing
Item database, source tags, verified NECA labor, custom labor/material rates, takeoff mapping, estimate builder, adders, estimate states, estimate line-level CRUD, CSV/PDF export, job-cost calibration, supplier-quote calibration, market factors and analytics.

### Projects
Project master data, project numbers, status, documents, takeoffs, estimates, RFIs, RFQs, quotes, suppliers, job costs, audit and commercial-risk rollup.

### RFIs
Full CRUD plus drawing/sheet/location, question, response, priority, due dates, ownership, attachments, commercial exposure, status history and project linkage.

### RFQs
Full CRUD plus source estimate/takeoff lines, recipients, supplier responses, due dates, bid leveling, lead times, exclusions, alternates and chosen commercial result.

### Suppliers
Full CRUD for supplier, contacts, categories, RFQ history, quote history, account-specific performance and approved/preferred status.

### Audit
Every sensitive mutation must record actor, account/tenant, organization, project when applicable, action, record context and timestamp.

## Jarvis AI Copilot

Jarvis is an application-aware operating copilot rather than a generic chat box. This implementation is independent of any separate/original Jarvis system and has no dependency on it unless an explicit integration is added later.

### Context Jarvis should understand

- Current user
- Platform role
- Active organization
- Active account/tenant
- Current screen
- Current project
- Current estimate / selected line
- Current RFI/RFQ/supplier when applicable
- Tenant settings
- Historical job costs
- Supplier quotes
- Market factors
- Audit history where permitted

### Capability modes

- **READ** — explain screens, records, calculations and business context.
- **DRAFT** — prepare estimate changes, RFIs, RFQs, summaries and recommendations without committing them.
- **ACT** — execute authorized server actions only after normal RBAC and explicit approval for consequential actions.

External sends, destructive deletes, awards, permission changes and approved-estimate changes require explicit confirmation.

### AI provider architecture

The application includes a provider-neutral `JARVIS_ENDPOINT` integration hook. Without an external provider Jarvis remains useful through built-in product guidance. With an external provider, Stratum sends a tenant-scoped context envelope and requires the provider to return an answer; write operations remain inside Stratum server actions rather than being delegated directly to the model.

## Automation priorities beyond Bluebeam-centric workflows

Stratum should not attempt to win by merely reproducing PDF markup. It should automate the commercial handoffs around drawings and takeoffs:

1. Revision change → quantity delta → labor/material delta → cost/schedule exposure.
2. Takeoff → cost item mapping → estimate creation.
3. Scope-gap detection across drawings, schedules, specifications, takeoff and estimate.
4. Estimate completeness / bid-health scoring.
5. Estimate line → RFQ package generation.
6. Supplier response normalization and automated bid leveling.
7. Quote validity / lead-time risk alerts.
8. RFI response → estimate/project commercial impact.
9. Job-cost actual → historical variance → approved calibration recommendation.
10. Project closeout → learned account/tenant labor and material performance.
11. Estimated quantity → installed quantity → earned labor → billing/progress support.
12. Historical comparable-project analysis for new bids.
13. Market-factor research → flagged exposure → explicit estimator approval before repricing.

## Value proposition

Stratum converts fragmented estimating and project information into a continuously learning commercial system of record.

The feedback loop is the product moat:

```text
Drawing / Takeoff
      ↓
Estimate
      ↓
RFQ / Supplier Quote
      ↓
Award / Execution
      ↓
Job Cost / Actual Labor
      ↓
Variance
      ↓
Approved Historical Calibration
      ↓
Better Next Estimate
```

The software adds value by reducing manual re-entry, exposing commercial risk earlier, connecting project information to money and labor, preserving organizational knowledge, improving estimate quality, shortening RFQ/RFI cycles and making historical performance useful in future decisions.

## Production migration status

The Neon production database now implements the Organization → Account/Tenant hierarchy. Existing Organization data was backfilled into a `Main Account`, existing organization memberships were copied to AccountMembership records, and all existing tenant-owned rows in the migrated domains were assigned to that account without orphaned data. Application code is being promoted through the `feature/account-tenant-jarvis` branch with account-scoped server checks before production rollout.
