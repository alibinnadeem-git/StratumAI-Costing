# Stratum AI Operations Suite — Merge Notes

This build merges the Stratum AI Costing Tool into the uploaded Stratum RFI/RFQ application and promotes the result to a multi-tenant, multi-organization server-backed product.

## What changed

- Costing is no longer a browser-only localStorage workspace. Organization-owned costing data is persisted through Prisma/Postgres and enforced by the active organization context.
- Existing project/RFI/RFQ/supplier functionality remains in the same product shell.
- A unified admin dashboard covers projects, RFIs, RFQs, suppliers, estimates, cost items, members and audit activity.
- Users can belong to multiple organizations and create/switch organizations. Data stays isolated by `organizationId`.
- `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` permissions are enforced server-side; `SUPER_ADMIN` adds platform-level tenant visibility.
- The cost catalog includes the prior Stratum starter catalog plus the conservative QA-cleaned NECA library.
- Estimates support Normal/Difficult/Very Difficult NECA labor tiers, organization defaults, estimate-level overrides, adders, project linking, and CSV export.
- Job Cost History and Supplier Quotes can calibrate organization-owned item rates.
- Project takeoffs can feed linked estimates.

## Deployment / database upgrade

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
npm start
```

For production, use a reviewed Prisma migration instead of `db push` if your deployment process requires migration history.

No additional environment variables are required beyond the existing database/auth/email settings in `.env.example`.

## Data note

The embedded NECA library intentionally contains only the rows retained by the prior QA-cleaning pass. It is designed to be conservative: uncertain OCR rows are excluded rather than guessed.
