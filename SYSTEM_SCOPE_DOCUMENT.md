# System Scope Document

Project: To Lopburi / Unclegalof business management platform  
Audit date: 2026-05-10  
Purpose: Detailed software scope for redevelopment pricing estimates.

## 1. Executive Overview

This system is a role-based business operations platform for a desk/furniture sales business. It supports owner administration, sales order entry, inventory receiving and cost tracking, delivery completion, repair/claim tracking, promotions, payment slip handling, and owner-level financial reporting.

The current implementation is a React single-page application backed by an Express API, PostgreSQL, Prisma ORM, JWT authentication, and Cloudflare R2-compatible object storage for uploaded images.

The implemented user roles are:

- `OWNER`: business owner/admin role. Can access all owner dashboards, staff management, promotions, delivery fees, purchasing costs, sales reports, and most operational screens.
- `SALES`: sales staff role. Can create sales, upload slips, see own sales, use inventory/product screens, and see sales commission insights.
- `REPAIRS`: repair/delivery staff role. Can manage repair records and complete delivery orders.

There is no separate `ADMIN` database role. In practice, `OWNER` is the administrative role.

## 2. Technical Stack

### Frontend

- Framework: React 18.
- Language: TypeScript.
- Build tool: Vite.
- Routing: React Router DOM.
- Icons: Lucide React.
- Styling: custom CSS in `client/src/styles/app.css` and owner dashboard CSS.
- API client: custom `fetch` wrapper in `client/src/lib/api.ts`.
- Auth state: React context in `AuthProvider`, persisted to `localStorage`.
- Upload flow: browser uploads directly to Cloudflare R2 after requesting a presigned URL from the backend.

### Backend

- Runtime: Node.js with ECMAScript modules.
- HTTP framework: Express 5.
- Database ORM: Prisma 6.
- Database: PostgreSQL.
- Validation: Zod.
- Authentication: JWT bearer tokens.
- Password hashing: Argon2.
- Rate limiting: `express-rate-limit`.
- Compression: `compression`.
- CORS: `cors`.
- File storage: Cloudflare R2 using AWS S3-compatible SDK.

### Repository Structure

- Root workspace manages `client` and `server`.
- `client`: React/Vite frontend.
- `server`: Express API, Prisma schema, migrations, scripts.
- `server/prisma`: database schema and migrations.

### Deployment and Runtime Configuration

The code indicates a Vercel-style frontend deployment and a separate Node API deployment.

Important environment variables used by the code:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `CLIENT_ORIGIN`
- `MAX_BODY_SIZE`
- `NODE_ENV`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `VITE_API_BASE_URL`

Local development uses Vite for the client and Express on port `4001` for the server. The frontend can proxy API requests to the backend.

## 3. Application Pages and Screens

### 3.1 Login

- Route: `/` and `/login`
- Access: public only. Authenticated users are redirected to their default role page.
- Purpose: authenticate an existing user.
- Visible sections:
  - Brand/auth hero shell.
  - Username input.
  - Password input.
  - Submit button.
  - Forgot password text/link placeholder.
  - Link to signup.
- Buttons/actions:
  - Login submits credentials to the backend.
  - Signup link navigates to `/signup`.
- Filters/search tools: none.
- Data shown:
  - Login errors.
  - Loading state.
- Editable fields:
  - Username.
  - Password.
- Workflow:
  1. User enters username and password.
  2. Frontend calls `/api/auth/login`.
  3. Backend verifies password hash and active status.
  4. JWT and user profile are returned.
  5. Token and user are stored in `localStorage`.
  6. User is routed by role:
     - Owner to `/owner`.
     - Sales to `/staff`.
     - Repairs to `/repair`.

### 3.2 Signup

- Route: `/signup`
- Access: public only.
- Purpose: create an initial owner account or a public sales account depending on bootstrap status.
- Visible sections:
  - Registration form.
  - Full name field.
  - Username field.
  - Password field.
  - Optional phone field.
  - Role selector when owner signup is allowed.
- Buttons/actions:
  - Create account.
  - Link back to login.
- Filters/search tools: none.
- Data shown:
  - Whether owner signup is allowed.
  - Registration errors/loading state.
- Editable fields:
  - Full name.
  - Username.
  - Password.
  - Phone.
  - Role choice when available.
- Workflow:
  1. Frontend calls `/api/auth/bootstrap-status`.
  2. If no users exist, owner signup is allowed.
  3. If users already exist, public registration is forced to the `SALES` role.
  4. User submits registration.
  5. Backend hashes password and creates user.
  6. Frontend stores token and routes user by role.

### 3.3 Staff Sales Hub

- Route: `/staff`
- Access: `OWNER`, `SALES`.
- Purpose: sales staff workspace for viewing current month sales and creating new orders.
- Internal views:
  - Home.
  - New order.
  - Sales list.
- Visible UI sections:
  - Month sales summary.
  - Order count summary.
  - Latest sales table.
  - Sales commission insight card for sales staff.
  - New order form.
  - Cart/order line area.
  - Payment section.
  - Delivery section.
  - Promo/manual discount area.
  - Sale detail drawer.
  - Payment slip lightbox.
  - Batch payment slip section.
- Buttons/actions:
  - Create new order.
  - Add product line to cart.
  - Remove product line from cart.
  - Upload sale photos.
  - Select payment status.
  - Select promotion.
  - Add manual discount and reason.
  - Select pickup or delivery.
  - Submit sale.
  - Open sale detail drawer.
  - Delete sale.
  - Upload or update payment slip.
  - View payment slip.
  - Select unpaid orders for batch slip.
  - Upload batch payment slip.
- Filters/search tools:
  - Current implementation loads the current calendar month.
  - Sales list supports selection for batch payment.
  - No visible month picker on this page.
- Data shown:
  - Current month sales total.
  - Current month order count.
  - Latest 10 sales on home.
  - Product catalog.
  - Delivery fee zones.
  - Promotions.
  - Commission insight for sales staff.
  - Sale/order metadata.
  - Payment status.
  - Delivery status.
  - Customer details.
  - Desk/product photos.
  - Worker fee and owner split values where available.
- Editable fields:
  - Product selection.
  - Quantity.
  - Payment status.
  - Promotion.
  - Manual discount amount/reason.
  - Delivery method.
  - Delivery distance.
  - Customer name.
  - Customer Thai phone number.
  - Delivery address / Google Maps link.
  - Remarks.
  - Sale photos.
  - Payment slip image.
- Important validation:
  - Delivery requires distance/address/customer info.
  - Thai delivery phone is normalized/validated as 10 digits.
  - Sale photos are limited in the frontend.
- Workflow: create sale
  1. Sales user opens `/staff`.
  2. Product catalog and delivery fees load.
  3. User selects one or more products and quantities.
  4. Unit price is selected from catalog based on pickup vs delivery pricing.
  5. User optionally applies promotion/manual discount.
  6. User selects pickup or delivery.
  7. If delivery, system calculates delivery zone fee from kilometers.
  8. User enters customer and address details.
  9. User optionally uploads sale photos through R2 presigned upload.
  10. User submits order.
  11. Backend creates `SalesOrder`, `SalesOrderLine`, mirrored `SaleRecord` rows, inventory movements, cost snapshots, and commissions if applicable.

### 3.4 Inventory

- Route: `/inventory`
- Access: `OWNER`, `SALES`.
- Purpose: stock overview, stock receiving, manual adjustments, and product catalog maintenance.
- Visible UI sections:
  - Inventory quantity summary by product.
  - Movement history.
  - Collapsible "see all" history.
  - Manual adjustment panel.
  - Product list panel.
  - Receive stock bottom sheet.
  - Create product modal.
  - Inline edit form for inbound movement records.
- Buttons/actions:
  - Receive stock.
  - Submit stock-in.
  - Manual adjust stock.
  - Confirm manual adjustment.
  - Create product.
  - Edit product.
  - Delete product.
  - Edit inbound inventory movement.
  - Save inbound movement edit.
  - Expand/collapse sections.
- Filters/search tools:
  - Product selection in stock and adjustment forms.
  - Movement list expansion.
- Data shown:
  - Remaining stock quantity by product.
  - Recent inventory movements.
  - Product names.
  - Onsite prices.
  - Delivery prices.
  - Movement direction (`IN` or `OUT`), quantity, timestamp, note.
- Editable fields:
  - Product name.
  - Onsite price.
  - Delivery price.
  - Stock receive quantity.
  - Manual adjustment quantity and direction.
  - Notes.
  - Inbound movement details.
- Workflow: receive stock
  1. User opens receive stock sheet.
  2. Selects product and quantity.
  3. Backend creates an `InventoryLot` with `remainingQty`.
  4. Backend creates an `InventoryMovement` with direction `IN`.
  5. In the regular staff flow, received stock may initially have cost `0`, creating pending cost review for owner.
- Workflow: manual stock adjustment
  1. User selects product, direction, quantity, and note.
  2. If direction is `IN`, backend creates a new inventory lot.
  3. If direction is `OUT`, backend consumes oldest lots first.
  4. Backend creates inventory movement rows.

### 3.5 Repairs / Claims

- Route: `/repair`
- Access: `OWNER`, `REPAIRS`.
- Purpose: record and manage damaged, repaired, or claimed items.
- Visible UI sections:
  - Repair/claim creation form.
  - Product selector.
  - Quantity field.
  - Size/color fields.
  - Reason/description.
  - Repair kind selector.
  - Date field.
  - Image uploader.
  - Repair cards/list.
  - Image preview/lightbox behavior.
- Buttons/actions:
  - Create repair/claim record.
  - Upload repair images.
  - Add image to existing repair.
  - Remove repair image.
  - Update status.
  - Delete repair record.
- Filters/search tools:
  - Product selector.
- Data shown:
  - Product name.
  - Quantity.
  - Size/color.
  - Description.
  - Repair kind (`repair` or `claim`).
  - Status.
  - Uploaded images.
  - Report date.
- Editable fields:
  - Product.
  - Quantity.
  - Size.
  - Color.
  - Description.
  - Kind.
  - Report date.
  - Images.
  - Status.
- Workflow:
  1. Repair staff selects product and enters damage/claim details.
  2. User uploads up to 8 images.
  3. Backend creates `RepairRecord`.
  4. Images are stored in R2 and URLs are stored in the record.
  5. Staff progresses status from `open` to `inprogress` to `done`.

### 3.6 Deliveries

- Route: `/deliveries`
- Access: `OWNER`, `REPAIRS`.
- Purpose: list home-delivery orders that are not yet completed and capture delivery proof.
- Visible UI sections:
  - Pending delivery order cards.
  - Customer name and phone.
  - Phone link.
  - Address / map URL linkified content.
  - Order lines.
  - Desk photo gallery/lightbox.
  - Complete delivery modal.
  - Delivery proof image uploader.
  - Optional Line group reminder dialog after completion.
- Buttons/actions:
  - Open phone link.
  - Open address/map link.
  - View photos.
  - Mark delivery complete.
  - Capture/upload delivery proof image.
  - Confirm completion.
- Filters/search tools:
  - None visible.
- Data shown:
  - Order number.
  - Sale date.
  - Total amount.
  - Customer details.
  - Product lines and quantities.
  - Desk photos.
  - Delivery completion state.
- Editable fields:
  - Delivery proof image only during completion.
- Workflow:
  1. Delivery staff opens `/deliveries`.
  2. System lists delivery orders where `deliveryCompletedAt` is empty.
  3. Staff opens an order and confirms delivery.
  4. Staff must upload proof image.
  5. Frontend uploads image to R2 with purpose `DELIVERY_PROOF`.
  6. Backend sets `deliveryCompletedAt` and proof image on order/records.
  7. Completed order disappears from pending queue.

### 3.7 Owner Dashboard Layout

- Route prefix: `/owner`
- Access: `OWNER`.
- Purpose: owner-only shell containing financial overview, reports, employees, promotions, purchasing, and delivery settings.
- Visible UI sections:
  - Sidebar navigation.
  - Mobile drawer navigation.
  - Bottom tab bar.
  - Global loading/error state.
  - Shared month/year state for tabs.
  - Payment slip lightbox.
- Owner tabs:
  - Overview: `/owner`.
  - Employees: `/owner/employees`.
  - Promotions: `/owner/promotions`.
  - Purchasing: `/owner/purchasing`.
  - Reports: `/owner/reports`.
  - Delivery fees: `/owner/delivery`.

### 3.8 Owner Overview

- Route: `/owner`
- Access: `OWNER`.
- Purpose: monthly business health and FIFO cost visibility.
- Visible UI sections:
  - Month/year selectors.
  - Refresh action.
  - KPI cards.
  - Pending cost alert section.
  - FIFO cost position table.
  - Payment status counts.
- Buttons/actions:
  - Change month.
  - Change year.
  - Refresh dashboard data.
- Filters/search tools:
  - Month selector.
  - Year selector.
- Data shown:
  - Income.
  - COGS.
  - Profit.
  - Margin.
  - Pending-cost orders.
  - FIFO inventory cost positions.
  - Payment status counts.
- Editable fields:
  - None on this screen.
- Important behavior:
  - Dashboard copy and backend logic distinguish confirmed COGS from pending owner review.
  - Pending cost rows indicate sales whose consumed inventory lot cost is not fully known.

### 3.9 Owner Employees

- Route: `/owner/employees`
- Access: `OWNER`.
- Purpose: manage employee accounts.
- Visible UI sections:
  - Staff member list.
  - Create staff modal.
- Buttons/actions:
  - Create staff.
  - Delete/deactivate staff.
- Filters/search tools:
  - None visible.
- Data shown:
  - Staff full name.
  - Username.
  - Role.
  - Phone if present.
  - Active state where exposed.
- Editable fields:
  - New staff full name.
  - Username.
  - Password.
  - Phone.
  - Role (`SALES` or `REPAIRS`).
- Workflow:
  1. Owner opens employee tab.
  2. Owner creates staff user.
  3. Backend hashes password and creates account.
  4. Owner can delete/deactivate staff via delete action.

### 3.10 Owner Promotions

- Route: `/owner/promotions`
- Access: `OWNER`.
- Purpose: create and manage sales promotions.
- Visible UI sections:
  - Create promotion form.
  - Promotion list.
- Buttons/actions:
  - Create promotion.
  - Toggle promotion active/inactive.
  - Delete promotion.
- Filters/search tools:
  - None visible.
- Data shown:
  - Promotion name.
  - Amount type.
  - Amount.
  - Active state.
- Editable fields:
  - Name.
  - Amount type (`fixed` or `percent`).
  - Amount.
  - Active state.
- Important behavior:
  - Frontend uses active promotions in order creation.
  - Backend verifies promotion existence but currently trusts the submitted discount amount from the client rather than recalculating promotion discount from promotion rules.

### 3.11 Owner Purchasing / Inventory Lots

- Route: `/owner/purchasing`
- Access: `OWNER`.
- Purpose: owner review and entry of per-lot inventory cost.
- Visible UI sections:
  - Inventory lot list.
  - Cost editing fields/actions for lots.
  - Indicators for lots with missing cost.
- Buttons/actions:
  - Edit lot cost.
  - Save updated cost.
- Filters/search tools:
  - Lot/product list view.
- Data shown:
  - Product name.
  - Lot quantity.
  - Remaining quantity.
  - Current cost per unit.
  - Created/received date.
  - Notes if present.
- Editable fields:
  - Cost per unit for inventory lots.
- Workflow:
  1. Staff may receive stock with cost `0`.
  2. Owner reviews inventory lots.
  3. Owner enters actual cost per unit.
  4. Backend updates the lot.
  5. Backend recalculates COGS/profit for sale lines that consumed that lot.
  6. Lines can move from `pending_owner_review` to `confirmed` when costs are known.

### 3.12 Owner Reports

- Route: `/owner/reports`
- Access: `OWNER`.
- Purpose: detailed monthly sales, payment verification, batch payment review, and gross profit visibility.
- Visible UI sections:
  - Month/year controls from owner context.
  - Week-of-month filter.
  - Payment status filter.
  - Sort controls.
  - Batch payment summary stats.
  - Sales report table.
  - Payment slip lightbox.
- Buttons/actions:
  - Change month/year.
  - Filter by week.
  - Filter by payment status.
  - Sort table.
  - View payment slip.
  - Mark slip as viewed.
  - Confirm sale paid.
  - Remove payment slip.
- Filters/search tools:
  - Month.
  - Year.
  - Week of month.
  - Payment status.
  - Sort field/direction.
- Data shown:
  - Order number.
  - Product.
  - Quantity.
  - Total amount.
  - Average unit cost.
  - Gross profit.
  - Payment status.
  - Payment batch number.
  - Recorder/created by.
  - Payment slip state.
- Editable fields:
  - Payment status through owner confirmation.
  - Payment slip removal.
- Workflow: owner confirms payment
  1. Staff uploads slip on individual sale or batch.
  2. Owner opens reports.
  3. Owner views the payment slip.
  4. Backend records `slipViewedAt`.
  5. Owner can confirm status as `paid`.
  6. Backend requires a slip and `slipViewedAt` before marking paid.

### 3.13 Owner Delivery Fees

- Route: `/owner/delivery`
- Access: `OWNER`.
- Purpose: maintain delivery zone pricing.
- Visible UI sections:
  - Delivery fee list by zone/range.
  - Editable fee inputs.
- Buttons/actions:
  - Edit zone fee.
  - Save delivery fees.
- Filters/search tools:
  - None visible.
- Data shown:
  - Distance/range bands.
  - Current delivery fee per band.
- Editable fields:
  - Delivery fee amounts.
- Workflow:
  1. Owner opens delivery settings.
  2. Existing fee rows load.
  3. Owner edits prices.
  4. Backend updates delivery fee table.
  5. Sales order form uses the updated fees.

## 4. Major Features and Workflows

### 4.1 Authentication and Roles

Features:

- JWT login.
- Public bootstrap registration.
- Owner-only staff creation.
- Protected frontend routes.
- Backend role middleware.
- Local browser session persistence.

Workflow:

1. User logs in with username/password.
2. Backend verifies Argon2 password hash.
3. Backend signs JWT with issuer/audience.
4. Frontend stores token and user profile.
5. API calls include `Authorization: Bearer <token>`.
6. Backend loads user from token and rejects inactive users.
7. Route-specific middleware checks `OWNER`, `SALES`, or `REPAIRS` permissions.

Access rules:

- Owner can access owner dashboard, staff page, inventory, repairs, deliveries.
- Sales can access staff page and inventory.
- Repairs can access repair and delivery pages.

### 4.2 Sales Orders

Features:

- Create multi-line orders.
- Product catalog lookup.
- Pickup vs delivery pricing.
- Promotion discount.
- Manual discount.
- Payment status.
- Customer information.
- Sale/desk photos.
- Payment slip upload.
- Individual payment tracking.
- Batch payment tracking.
- Sale deletion.
- Sales commission calculation.
- Inventory deduction.
- FIFO cost snapshots.
- Owner gross profit reporting.

Workflow: create order

1. User selects products and quantities.
2. System determines unit price based on delivery method.
3. User applies optional promotion/manual discount.
4. System calculates subtotal, discount, delivery fee, and grand total.
5. User enters delivery/customer data if delivery is selected.
6. User uploads optional sale photos.
7. Backend validates payload.
8. Backend resolves product records.
9. Backend calculates delivery zone from kilometers.
10. Backend calculates worker payout fields.
11. Backend creates a logical `SalesOrder`.
12. Backend creates `SalesOrderLine` rows for each product.
13. Backend creates mirrored `SaleRecord` rows for compatibility/reporting.
14. Backend deducts inventory FIFO.
15. Backend stores consumed lot references.
16. Backend calculates COGS, gross profit, and cost status.
17. Backend creates commission records for sales staff where applicable.

Workflow: payment slip

1. Staff opens a sale detail drawer.
2. Staff uploads payment slip to R2.
3. Backend saves slip URL on sale/order rows.
4. Owner opens report.
5. Owner views slip.
6. Backend records slip viewed timestamp.
7. Owner confirms sale as paid.

Workflow: batch payment

1. Staff selects multiple unpaid sales without a batch.
2. Staff uploads one payment slip.
3. Backend creates `PaymentBatch`.
4. Backend attaches selected sale records to the batch.
5. Owner sees batch number and batch stats in reports.

Important business rules:

- Owner must view a payment slip before confirming paid.
- Sales staff can only mutate their own sales unless owner.
- Sales list for sales staff is filtered to their own records.
- Deleting a sale currently does not restore inventory.

### 4.3 Inventory

Features:

- Product catalog management.
- Stock receiving.
- Inventory lots.
- FIFO stock deduction.
- Inventory movements.
- Manual adjustment.
- Lot cost entry.
- Pending cost review.
- Retroactive COGS recalculation.

Workflow: stock receiving

1. User receives stock for a product.
2. Backend creates an `InventoryLot`.
3. Backend creates an `InventoryMovement` with direction `IN`.
4. If cost is unknown, lot cost is `0`.
5. Owner later updates cost in purchasing tab.

Workflow: FIFO stock deduction on sale

1. Backend loads available inventory lots for product.
2. Lots are sorted oldest first.
3. Quantities are consumed from oldest lots until sale quantity is fulfilled.
4. Each consumed lot creates inventory `OUT` movement.
5. Each consumed lot is linked to the sale line.
6. If insufficient stock exists, shortage creates an unallocated consumption with zero cost.
7. Sale line cost status becomes pending when one or more cost values are unknown.

Workflow: owner cost review

1. Owner opens purchasing tab.
2. Owner finds lots with missing or zero cost.
3. Owner enters actual cost per unit.
4. Backend updates the lot cost.
5. Backend updates cost logs where applicable.
6. Backend recalculates affected sale line COGS and gross profit using consumed lot links.
7. Backend updates sale/order cost status.

### 4.4 Products and Pricing

Features:

- Product creation.
- Product editing.
- Product deletion.
- Onsite price.
- Delivery price.
- Product use in sales, inventory, repairs, and pipeline.

Data model:

- `DeskItem.name`
- `DeskItem.onsitePrice`
- `DeskItem.deliveryPrice`

Workflow:

1. Owner or sales user manages catalog from inventory page.
2. Sales form loads products from catalog.
3. Pickup orders use onsite price.
4. Delivery orders use delivery price.
5. Product records are linked to sales lines, repair records, inventory lots, movements, and pipeline items.

### 4.5 Delivery Pricing and Delivery Completion

Features:

- Delivery fee zones by distance.
- Delivery price lookup from kilometers.
- Pending delivery queue.
- Proof-of-delivery upload.
- Delivery completed timestamp.

Workflow: delivery pricing

1. Owner configures delivery fees by distance zone.
2. Sales user enters delivery distance in kilometers.
3. System maps kilometers to a delivery range.
4. Delivery fee is added to order total.
5. Delivery distance fee is also used in worker payout calculations.

Workflow: complete delivery

1. Delivery staff opens pending queue.
2. Staff verifies customer/order details.
3. Staff uploads proof image.
4. Backend sets delivery completed timestamp and proof image URL.
5. Order is removed from delivery queue.

### 4.6 Repairs and Claims

Features:

- Repair/claim creation.
- Product association.
- Quantity, size, color, reason.
- Image upload.
- Status progression.
- Delete repair record.

Workflow:

1. Repair staff creates repair or claim record.
2. Images are uploaded to R2.
3. Record is saved with images and description.
4. Staff updates status as work progresses.
5. Completed records remain in history.

### 4.7 Promotions

Features:

- Create promotion.
- Fixed or percent discount.
- Toggle active/inactive.
- Delete promotion.
- Use active promotion on sales form.

Workflow:

1. Owner creates promotion with name, type, and amount.
2. Active promotions appear in sales form.
3. Sales user selects promotion.
4. Frontend computes discount.
5. Backend records applied promotion and submitted discount.

Important implementation note:

- Backend currently validates that promotion exists, but it does not fully recalculate the promotion discount amount from stored promotion rules. This should be considered for redevelopment if stricter financial control is needed.

### 4.8 Financial Reporting

Features:

- Monthly owner dashboard.
- Income.
- COGS.
- Profit.
- Margin.
- Pending cost exclusion.
- Gross profit by sale line.
- Payment status counts.
- Batch payment summaries.
- Owner payment verification.
- Cost positions.

Important calculations:

- Income is based on sales amounts in the selected month.
- COGS is based on FIFO consumed inventory costs.
- Gross profit is calculated from sale line amount minus worker fee minus COGS.
- Pending cost rows are highlighted when inventory cost is unknown.
- Owner dashboard separates confirmed cost from pending owner review.
- Owner net income on order is stored as grand total minus employee payout.

### 4.9 Sales Commission

Features:

- Commission records for sales staff.
- Sales commission insights on staff page.
- Monthly/yearly progress display.

Known rule from implementation:

- First 20 units/month are free/no commission.
- After threshold, commission is 200 THB per unit.
- Commission is recorded per sale line for sales staff.
- Payroll payout is not implemented as an active workflow, even though `PayrollRecord` exists in schema.

### 4.10 Pipeline / Purchasing Plan

Features implemented in backend:

- Owner-only pipeline CRUD.
- Product association.
- Quantity.
- Estimated cost.
- Expected date.
- Note.
- Status: planned, ordered, transit, arrived.
- Priority: normal, urgent, low.

Current UI status:

- Backend API and context loading exist.
- No fully visible owner tab workflow was identified for editing pipeline items in the current routed pages.
- No automatic conversion from pipeline item to inventory lot is implemented.

## 5. Backend API Surface

Base prefix: `/api`.

### Public / Auth

- `GET /api/health`
- `GET /api/auth/bootstrap-status`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/staff`
- `POST /api/auth/staff`
- `DELETE /api/auth/staff/:id`

### Uploads

- `POST /api/uploads/presign-upload`
- `POST /api/uploads/save-metadata`

Supported upload purposes:

- `PAYMENT_SLIP`
- `REPAIR_IMAGE`
- `SALE_IMAGE`
- `DELIVERY_PROOF`

### Catalog

- `GET /api/catalog/products`
- `POST /api/catalog/products`
- `PATCH /api/catalog/products/:id`
- `DELETE /api/catalog/products/:id`
- `GET /api/catalog/delivery-fees`
- `PUT /api/catalog/delivery-fees`

### Promotions

- `GET /api/promotions`
- `POST /api/promotions`
- `PATCH /api/promotions/:id`
- `DELETE /api/promotions/:id`

### Sales

- `GET /api/sales?month=&year=`
- `GET /api/sales/commission-insights`
- `POST /api/sales`
- `POST /api/sales/batch-payment`
- `PATCH /api/sales/:id/payment-slip`
- `DELETE /api/sales/:id/payment-slip`
- `PATCH /api/sales/:id/slip-viewed`
- `PATCH /api/sales/:id/status`
- `DELETE /api/sales/:id`

### Inventory

- Inventory summary endpoints.
- Inventory product endpoints.
- Stock-in endpoints.
- Lot endpoints.
- Batch lot receiving.
- Manual adjustment.
- Inbound movement update.
- Owner lot cost update.

Exact endpoint paths are defined in `server/src/routes/inventory.routes.js`.

### Repairs

- Repair list.
- Repair creation.
- Repair status update.
- Repair image upload/remove.
- Repair deletion.

Exact endpoint paths are defined in `server/src/routes/repairs.routes.js`.

### Deliveries

- `GET /api/deliveries`
- `PATCH /api/deliveries/:id/complete`

### Owner Dashboard

- `GET /api/dashboard/owner?month=&year=`

### Pipeline

- Owner-only CRUD under `/api/pipeline`.

### Unmounted / Dead Route Files

The following route files exist but are not mounted in the Express app:

- `server/src/routes/orders.routes.js`
- `server/src/routes/reports.routes.js`
- `server/src/routes/owner.routes.js`

The `owner.routes.js` file appears inconsistent with the current schema and role model and should be treated as legacy/dead code unless intentionally revived.

## 6. Database Models and Relationships

### User

Purpose: accounts for owners, sales staff, and repair/delivery staff.

Important fields:

- `id`
- `fullName`
- `username`
- `passwordHash`
- `phone`
- `role`
- `ownerId`
- `baseSalary`
- `isActive`

Relationships:

- Created sales.
- Created sales orders.
- Repair records reported.
- Uploaded files.
- Payroll records.
- Inventory movements.
- Payment batches.

### DeskItem

Purpose: product/catalog item.

Important fields:

- `name`
- `onsitePrice`
- `deliveryPrice`

Relationships:

- Sale records.
- Sales order lines.
- Repair records.
- Inventory lots.
- Inventory movements.
- Pipeline items.
- Cost logs.

### DeliveryFee

Purpose: delivery distance/range pricing.

Important fields:

- `range`
- `cost`

Relationships:

- Sales records.
- Sales orders.

### Promotion

Purpose: sales promotion definitions.

Important fields:

- `name`
- `amountType`
- `amount`
- `isActive`

Relationships:

- Sales records.
- Sales orders.

### SalesOrder

Purpose: logical order header for multi-line sales.

Important fields:

- `orderNumber`
- `status`
- `saleDate`
- `subtotal`
- `grandTotal`
- `promoDiscountTotal`
- `manualDiscount`
- `deliveryType`
- `deliveryCompletedAt`
- `deliveryRange`
- `workerFee`
- `workerLiftFee`
- `workerDistanceFee`
- `employeePayout`
- `ownerNet`
- `customerName`
- `customerPhone`
- `deliveryAddress`
- `deskPhotos`
- `paymentSlipImage`
- `slipViewedAt`
- `paidAt`
- `deliveryProofImage`
- `createdByUserId`

Relationships:

- Owner/tenant user.
- Creator user.
- Delivery fee.
- Promotion.
- Sales order lines.
- Mirrored sale records.

### SalesOrderLine

Purpose: individual product line inside a sales order.

Important fields:

- `lineNumber`
- `deskItemId`
- `quantity`
- `unitPrice`
- `promoDiscount`
- `manualDiscount`
- `amount`
- `avgUnitCostSnapshot`
- `cogsTotal`
- `grossProfit`
- `workerLiftFee`
- `costStatus`

Relationships:

- Parent sales order.
- Product.
- Consumed inventory lots.

### SaleRecord

Purpose: reporting/compatibility row for sale lines. Mirrors sales order line data and carries payment/delivery fields.

Important fields:

- `ownerId`
- `saleDate`
- `orderNumber`
- `deskType`
- `quantity`
- `unitPrice`
- `status`
- `amount`
- `cogsTotal`
- `grossProfit`
- `costStatus`
- `deliveryType`
- `deliveryCompletedAt`
- `paymentSlipImage`
- `paymentBatchId`
- `salesOrderId`
- `createdByUserId`

Relationships:

- Product.
- Delivery fee.
- Promotion.
- Creator user.
- Payment batch.
- Sales order.
- Commissions.
- Tenant owner.
- Consumed lots.

### PaymentBatch

Purpose: groups multiple sale records under one uploaded payment slip.

Important fields:

- `batchNumber`
- `totalAmount`
- `transferAmount`
- `paymentSlipImage`
- `note`
- `createdByUserId`

Relationships:

- Created by user.
- Sale records.

### InventoryLot

Purpose: received stock batch with remaining quantity and cost.

Important fields:

- `deskItemId`
- `qty`
- `remainingQty`
- `costPerUnit`
- `note`

Relationships:

- Product.
- Inventory movements.
- Sale consumed lots.

### InventoryMovement

Purpose: stock movement audit trail.

Important fields:

- `deskItemId`
- `inventoryLotId`
- `direction`
- `qty`
- `note`
- `createdByUserId`

Relationships:

- Product.
- Inventory lot.
- Creator user.

### SalesOrderLineConsumedLot

Purpose: FIFO consumption trace that links sale lines to inventory lots.

Important fields:

- `salesOrderLineId`
- `saleRecordId`
- `inventoryLotId`
- `consumedQty`
- `costPerUnitAtSale`

Importance:

- Enables retroactive COGS recalculation when owner enters missing lot cost.
- Represents shortages with `inventoryLotId` null.

### RepairRecord

Purpose: repair/claim tracking.

Important fields:

- `deskItemId`
- `reportedBy`
- `reportDate`
- `quantity`
- `size`
- `color`
- `description`
- `kind`
- `status`
- `amount`
- `images`

### SaleRecordCommission

Purpose: commission entries for sales staff.

Important fields:

- `saleRecordId`
- `userId`
- `amount`
- `remarks`

### PayrollRecord

Purpose: modeled payroll records.

Current status:

- Present in schema.
- No active frontend/backend workflow identified.

### PipelineItem

Purpose: incoming supply or purchase planning.

Important fields:

- `deskItemId`
- `qty`
- `costEst`
- `expectedDate`
- `note`
- `status`
- `priority`

### R2File

Purpose: uploaded file metadata.

Important fields:

- `objectKey`
- `fileUrl`
- `bucketName`
- `originalFileName`
- `contentType`
- `fileSize`
- `purpose`
- `uploadedByUserId`

## 7. Business Logic and Calculations

### FIFO Inventory Deduction

- Used when creating sales and manual stock-out adjustments.
- Oldest inventory lots are consumed first.
- Each consumption reduces `InventoryLot.remainingQty`.
- Each consumption creates or supports inventory movement records.
- Sale line cost is calculated from consumed quantity times cost at sale.
- If lot cost is zero, sale line becomes pending owner review.
- If stock is insufficient, shortage is tracked as unallocated zero-cost consumption.

### Cost Tracking

- Inventory lots store `costPerUnit`.
- Stock can be received with unknown cost.
- Owner later updates cost.
- Cost update recalculates affected historical sales through consumed lot records.
- Cost status values:
  - `confirmed`
  - `pending_owner_review`

### Gross Profit

Implemented sale line formula:

- `grossProfit = lineAmount - workerFee - cogsTotal`

Related values:

- `lineAmount` includes allocated order-level effects such as discounts and delivery/customer fee share.
- `cogsTotal` comes from FIFO lot consumption.
- `workerFee` includes worker payout allocation.

### Owner Net

Order-level owner net is stored as:

- `ownerNet = grandTotal - employeePayout`

Where employee payout is composed of:

- Worker lift fee.
- Worker distance fee for deliveries.

### Worker Fees

The backend contains logic for:

- Product/category-based lift fees.
- Delivery distance worker fee.
- Employee payout total.
- Owner net after employee payout.

### Sales Commission

The backend computes commission for sales staff:

- Monthly unit threshold before commission.
- Per-unit commission after threshold.
- Commission entries linked to sale records.
- Insights endpoint for frontend display.

### Payment Status

Payment status enum:

- `pending`
- `deposit`
- `paid`

Owner confirmation rule:

- A payment slip must exist.
- Owner must view the slip first.
- Only then can owner mark sale as paid.

### Delivery Status

Delivery completion uses:

- `deliveryCompletedAt`
- `deliveryProofImage`

Pending delivery queue includes delivery sales without completion timestamp.

### Seeding / Automation

- Default catalog/delivery fee/promotion setup runs during login/register-related flows through catalog ensure logic.
- No cron jobs, queues, background workers, or scheduled automation were identified.

## 8. External Integrations

### Database

- PostgreSQL through Prisma.

### Authentication

- Internal username/password authentication.
- Argon2 password hashing.
- JWT bearer tokens.
- No third-party auth provider identified.

### Storage

- Cloudflare R2-compatible object storage.
- Uses AWS S3 SDK and presigned PUT URLs.
- Stores sale photos, payment slips, repair images, and delivery proof.

### Payments

- No direct payment gateway integration identified.
- Payment is tracked manually through payment status and uploaded slip images.

### Maps

- No formal maps API integration identified.
- Delivery address field can contain Google Maps links and UI linkifies URLs.

### Notifications

- No SMS/email/push notification integration identified.
- UI includes an optional reminder to post in a Line group after delivery completion, but no automated Line API integration was found.

### Deployment

- Frontend appears compatible with Vercel deployment.
- Backend is a standalone Node/Express service.
- Docker development scripts exist, but production hosting provider for backend is not hardcoded in source.

## 9. Complexity Estimate by Module

### Authentication and Role Access: Medium

Reason:

- Standard username/password/JWT flow.
- Multiple roles and route guards.
- Staff creation and bootstrap owner registration add moderate complexity.

### Sales Order Entry: Complex

Reason:

- Multi-line orders.
- Delivery vs pickup pricing.
- Promotions and manual discounts.
- Customer delivery data.
- Photo uploads.
- Payment states.
- Inventory deduction.
- Worker payout.
- Commission.
- Profit/cost snapshots.

### Payment Slip and Batch Payment Tracking: Medium

Reason:

- R2 uploads and metadata.
- Individual and batch slips.
- Owner viewed/paid workflow.
- No payment gateway integration, which keeps complexity below full payment processing.

### Inventory Management: Complex

Reason:

- Inventory lots.
- FIFO deduction.
- Manual adjustments.
- Movement audit history.
- Unknown cost handling.
- Retroactive COGS recalculation.
- Pending owner review states.

### Product Catalog: Simple to Medium

Reason:

- Basic CRUD with two price fields.
- Complexity increases because products are referenced by sales, inventory, repairs, and pipeline.

### Owner Financial Dashboard: Complex

Reason:

- Monthly aggregation.
- Profit/margin calculations.
- Pending cost exclusion.
- FIFO cost positions.
- Payment status breakdowns.
- Requires consistency across sales, inventory, and payment modules.

### Owner Reports: Complex

Reason:

- Filtering, sorting, payment verification, batch payment display.
- Financial fields require correct COGS and gross profit.
- Owner-only actions have business rules.

### Delivery Queue: Medium

Reason:

- Pending delivery filtering.
- Proof image upload.
- Completion workflow.
- Customer/contact/map display.
- No external logistics integration.

### Repairs / Claims: Medium

Reason:

- CRUD workflow with images and status.
- Simpler than sales/inventory but includes storage integration.

### Promotions: Simple to Medium

Reason:

- Basic promotion CRUD.
- Discount application touches sales totals.
- Should be stricter if backend recalculation is required.

### Employee Management: Simple

Reason:

- Owner creates/deletes staff accounts.
- No complex permissions UI or payroll workflow implemented.

### Sales Commission: Medium

Reason:

- Threshold logic and per-line commission records.
- Insights display exists.
- Full payroll payout is not implemented.

### Purchasing / Pipeline: Medium

Reason:

- Inventory cost review is complex because it recalculates historical sale costs.
- Pipeline itself is simple CRUD but not fully surfaced in UI.

### File Upload System: Medium

Reason:

- Presigned uploads.
- Multiple file purposes.
- R2 metadata persistence.
- Cleanup behavior for some deletions.

## 10. Known Gaps, Risks, and Redevelopment Notes

- No separate admin role exists; owner functions as admin.
- Sale deletion does not restore inventory stock.
- Promotion discount amount is trusted from frontend instead of fully recalculated on backend.
- Payroll model exists but payroll workflow is not implemented.
- Pipeline backend exists but UI appears incomplete or not fully exposed.
- Some route files are present but unmounted/dead.
- Current system appears designed for a single company/canonical owner, even though some tenant fields exist.
- Staff `ownerId` behavior may need redesign for true multi-tenant support.
- Direct payment processing is not integrated.
- No automated notification integration is present.
- No scheduling/queue system is present.
- Reports depend heavily on correct inventory cost entry.
- If costs are left pending, profit numbers need careful interpretation.

## 11. Suggested Freelancer Scope Wording

Ask developers to estimate a redevelopment of:

1. A role-based React web app with owner, sales, and repair/delivery roles.
2. JWT authentication with owner bootstrap registration and owner-managed staff accounts.
3. Product catalog with onsite and delivery pricing.
4. Sales order creation with multi-line carts, discounts, promotions, delivery/customer fields, sale photos, payment status, and payment slips.
5. Inventory lot management with FIFO stock deduction, movement history, manual adjustments, owner cost entry, pending cost review, and retroactive COGS recalculation.
6. Owner financial dashboard with income, COGS, profit, margin, pending costs, FIFO cost positions, and payment status counts.
7. Owner reports with filters, sorting, gross profit, batch payment visibility, slip viewing, and paid confirmation workflow.
8. Delivery queue with pending orders, customer/contact details, proof-of-delivery upload, and completion state.
9. Repair/claim management with image uploads and status tracking.
10. Promotion management with fixed/percentage discounts.
11. Delivery fee zone management.
12. Sales commission tracking and insights.
13. Cloud object storage integration for images and slips.
14. PostgreSQL database schema, Prisma ORM, migrations, and API endpoints.

## 12. Pricing Estimate Guidance

For freelancer quoting, this should not be treated as a small CRUD app. The highest-effort areas are:

- Sales order creation and payment workflow.
- FIFO inventory and cost recalculation.
- Owner financial reports.
- File upload integration.
- Role-specific frontend UX.

A realistic quote should include:

- Requirements confirmation.
- UI/UX rebuild.
- Database schema design/migration.
- Backend API implementation.
- Frontend implementation.
- File storage integration.
- Testing of inventory/profit calculations.
- Deployment setup.
- Data migration if existing production data must be preserved.

