# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Unclegalof" is a business management platform for a desk/furniture sales company. It's a monorepo with a React/TypeScript frontend and an Express/Node.js backend, using PostgreSQL via Prisma ORM and Cloudflare R2 for file storage.

## Commands

### Development

```bash
npm run dev              # Start both client (port 5173) and server (port 4001) with hot reload
npm run dev:client       # Client only
npm run dev:server       # Server only
npm run docker:up        # Docker Compose — builds images, runs migrations, starts both services
npm run docker:down      # Tear down Docker containers
```

### Build

```bash
npm run build            # Build both workspaces
```

### Database (Prisma)

```bash
npm run prisma:generate       # Regenerate Prisma client after schema changes
npm run prisma:migrate        # Create and apply a new migration (dev)
npm run prisma:migrate:deploy # Apply migrations (production)
npm run prisma:seed           # Seed database with test data
npm run prisma:studio         # Open Prisma Studio UI
```

### First-time Setup

1. `npm install`
2. Copy `.env.example` files in `client/` and `server/` and fill in values
3. `npm run prisma:generate`
4. `npm run dev`

### Testing

There is no automated test suite. Use `TESTING_GUIDE.md` for manual test flows. In development, `POST /api/test-setup` creates seed data.

## Architecture

### Monorepo Structure

- `client/` — React 18 + TypeScript + Vite frontend
- `server/` — Node.js + Express 5 + Prisma backend
- `docker-compose.yml` / `Dockerfile.dev` — Local dev orchestration

### Frontend (`client/src/`)

- **`main.tsx`** — Entry point; wraps app with `<Router>` and `<AuthProvider>`
- **`App.tsx`** — All route definitions; role-gated via `<ProtectedRoute>`
- **`pages/`** — One file per page (LoginPage, InventoryPage, DeliveryOrdersPage, RepairPage, StaffPage, owner/* for owner-only tabs)
- **`components/`** — Shared layout (`AppShell`, `AuthHeroShell`, `ProtectedRoute`) and reusable UI
- **`lib/api.ts`** — Fetch wrapper that attaches `Authorization: Bearer <token>` from localStorage; all API calls go through this
- **`lib/`** — Business-logic helpers: `deliveryZones`, `promotions`, `roleRoutes`, `thaiPhone`, `upload` (presigned R2 upload flow)
- **`data/constants.ts`** — Shared app constants

Vite proxies `/api/*` → `http://localhost:4001` in dev. For production builds, `VITE_API_BASE_URL` sets the API origin.

### Backend (`server/src/`)

- **`index.js`** → **`app.js`** — Express app factory: middleware stack, route mounting, global error handler
- **`routes/`** — One file per domain:
  - `auth.routes.js` — Login/signup/logout
  - `sales.routes.js` — Sales order CRUD
  - `catalog.routes.js` — Desk item (product) management
  - `inventory.routes.js` — Stock lot management
  - `repairs.routes.js` — Repair/claim tracking
  - `deliveries.routes.js` — Delivery completion
  - `promotions.routes.js` — Discount promotions
  - `pipeline.routes.js` — Incoming supply orders
  - `dashboard.routes.js` — Owner financial reports
  - `uploads.routes.js` — Presigned URL generation for R2
- **`middleware/`** — `auth.middleware.js` (JWT verification), `authorize.middleware.js` (role check), `rateLimit.middleware.js`
- **`lib/`** — Domain logic and utilities:
  - `adapters.js` — Converts between DB format and frontend format (critical for all response shaping)
  - `salesOrders.js`, `salesCommission.js`, `workerPayouts.js` — Financial computation
  - `promotions.db.js`, `inventoryCost.js`, `deliveryZones.js` — Business rules
  - `r2.js`, `r2Cleanup.js` — Cloudflare R2 file operations
  - `prisma.js` — Shared Prisma client instance
  - `jwt.js`, `password.js` (Argon2) — Auth utilities
  - `tenant.js`, `company.js` — Multi-tenancy helpers (every query must scope by `ownerId`)

### Database (Prisma Schema)

Key models and their relationships:

| Model | Purpose |
|---|---|
| `User` | Users with roles: `OWNER`, `SALES`, `REPAIRS` |
| `DeskItem` | Products with onsite/delivery prices |
| `SalesOrder` + `SalesOrderLine` | Modern multi-line order model |
| `SaleRecord` | Legacy single-item sale (kept for backwards compatibility) |
| `InventoryLot` | Stock batches with FIFO tracking (`remainingQty`) |
| `InventoryMovement` | IN/OUT stock movements |
| `SalesOrderLineConsumedLot` | FIFO lot consumption for retroactive COGS |
| `RepairRecord` | Repair/claim reports with images |
| `PipelineItem` | Incoming supply orders (planned→ordered→transit→arrived) |
| `PayrollRecord` | Monthly payroll (salary + commission + bonus − deduction) |
| `R2File` | Uploaded file metadata (payment slips, repair images, delivery proofs) |
| `Promotion` | Discounts (fixed amount or percent) |
| `PaymentBatch` | Groups of payment slips for owner verification |

### Auth & Authorization

- JWT bearer tokens — stored in `Authorization` header and localStorage
- Role hierarchy: `OWNER` > `SALES` / `REPAIRS`
- All data is tenant-scoped: every DB query filters by `ownerId` (the owner's User ID)
- Backend middleware chain: `authenticate` → `authorize([...roles])` → route handler

### File Uploads

Browser uploads directly to Cloudflare R2 via presigned URLs:
1. Frontend calls `POST /api/uploads/presign` to get a signed URL
2. Browser PUTs the file directly to R2
3. Frontend stores the returned public URL in the order/repair record

### Key Architectural Decisions

- **Dual sale models**: `SalesOrder` (current) and `SaleRecord` (legacy) coexist — do not remove `SaleRecord` without confirming no active references
- **FIFO costing**: `SalesOrderLineConsumedLot` links order lines to inventory lots consumed; COGS is retroactively recalculated when lot costs are known
- **`adapters.js` is the source of truth** for what shape the frontend expects — always update adapters when changing DB schema field names
- **Worker payout tracking**: lift fees and distance fees are tracked per `SalesOrderLine`, not just per order
- **Tenant isolation**: `lib/tenant.js` and `lib/company.js` provide helpers — always use these rather than hardcoding `ownerId` lookups
