# Gather Catering — experimental V1

An open-source catering experiment built with Next.js, TypeScript and optional Supabase persistence. The original PHP application remains in the parent folder; this directory is the new, independent application.

## Try locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Choose **Workspace**, username **demo**, password **123456**. Without Supabase environment variables, all changes stay in that browser's localStorage. Different browsers and domains have different demo data. The demo login is a navigation convenience, not a security boundary. Use fictional data only. No money is moved.

## Included

- Responsive menu storefront; editable menus and fixed-price packages.
- Guest checkout, lead time/minimum guest/daily capacity checks, server-side prices in connected mode.
- Private tracking codes, order summaries suitable for printing, controlled order statuses.
- Bank transfer, merchant QR-image instructions and cash. Administrators manually verify and record payments.
- Partial payments, refunds, outstanding balances, categorized expenses, date filtering and CSV export.
- Supplier bills and approved payroll amounts by worker/pay period; partial settlement posts an expense once.
- Archive menus while retaining historical order snapshots.
- Demo mode without external accounts, plus shared Supabase mode with server-only database access.

## Supabase setup

1. Create a new Supabase project, preferably in Singapore for a nearby test audience. Choose a strong database password in Supabase; the demo password is only for the application's test login.
2. Open SQL Editor and run `supabase/migrations/001_v1.sql`.
3. Copy `.env.example` to `.env.local` for local development. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the project API settings. Keep the service role key server-side; never put it in a `NEXT_PUBLIC_` variable or commit it.
4. Set `ADMIN_USERNAME=demo` and `ADMIN_PASSWORD=123456` only for this fictional-data experiment, as requested. Use a different strong password before using any real data.
5. Generate a random session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it as `SESSION_SECRET`.
6. Restart the app. Its banner now says **CONNECTED WORKSPACE**. The first saved change persists the starter catalogue.

RLS blocks browser access to all tables and RPCs. Server routes authenticate administrators and require same-origin POSTs. Login and ordering have database-backed request limits. Order tracking requires a 256-bit random capability token; it is sent in a POST body, while share links use a URL fragment.

## Deploy on Vercel

Import this repository, select Next.js, and use the repository root as the root directory. If you instead commit this directory beneath a larger repository, set the root directory to `v1`.

- For an isolated demo, deploy with no environment variables.
- For shared data, add the five variables from `.env.example` to Vercel, apply the Supabase migration, then deploy/redeploy.
- Use separate Supabase projects for preview and production before adopting real data.
- The site is a personal, non-commercial experiment. Reassess hosting terms before commercial use.

## Payment setup

Workspace → Settings lets you enter bank details and an HTTPS URL for an existing merchant QR image. The app does not generate banking QR payloads or pretend to confirm a transfer. A customer selects a method, receives instructions, and uses the short order reference. The owner checks their bank or receives cash, then records the actual payment in Finances. Partial payments and refunds adjust the balance.

## Run checks

```sh
npm test
npm run typecheck
npm run build
```

The business-rule tests cover price snapshots, invalid dates, minimum guests, capacity/cancellations, payment/refund limits, duplicate ledger events, order transitions and payroll settlement.

## Self-host later

The application uses standard Node.js and can run on your own server with `npm ci`, `npm run build`, and `npm start`, behind an HTTPS reverse proxy. You can initially keep hosted Supabase, or use a self-hosted Supabase installation and change the URL/key. Ordinary PostgreSQL alone is not a drop-in replacement for the Supabase client/API; that would need a database adapter. Keep environment secrets out of Git and back up database contents. No Vercel-specific storage service is required.

## Deliberate V1 boundaries

- This is an experiment, not a production accounting or payroll system.
- Shared data is stored as one versioned JSON aggregate in PostgreSQL. Optimistic compare-and-swap updates prevent overwriting concurrent changes. This is simple and portable for small tests; split it into normalized tables and paginated queries before larger workloads. The internal audit list retains only the latest 500 mutations.
- There is one administrator account configured by environment variables. No staff roles, email notifications, gateway webhooks, password recovery or automated bank reconciliation yet.
- QR image hosting is external. There are no file uploads, receipt attachments or generated payment-receipt PDFs. Browser printing creates an order summary.
- Menus use illustrative emoji artwork. Packages are individually priced catalogue entries; configurable component bundles and photo uploads are future work.
- Payroll amounts are entered after approval. Automatic rate-based payroll and worker assignment scheduling from the legacy project have not been migrated.
- Prices are in MYR. Dates and report cutoffs use UTC. Delivery fees, taxes, service-area rules and formal financial statements are not implemented.
- Client demo state can be edited through developer tools. Connected mode enforces the rules on the server.
- Duplicate IDs protect ledger retries and bill settlement. A retried checkout after an uncertain network failure should first check its tracking link; checkout idempotency is not yet implemented.
- No legacy MySQL records, uploaded receipts, or personal information are included in this repository.

## License

MIT for the new V1 code. Dependency licenses remain with their respective authors.
