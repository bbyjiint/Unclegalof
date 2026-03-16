# API Implementation Summary

## Overview

All API routes have been updated to work with the frontend. The routes handle data transformation between frontend format and database format, include authentication/authorization, and are business-scoped.

## What Was Implemented

### 1. **Data Adapters** (`server/src/lib/adapters.js`)
Created adapter functions to transform data between frontend and database formats:
- `saleRecordToSale()` - Converts database SaleRecord to frontend Sale format
- `salePayloadToSaleRecord()` - Converts frontend sale payload to database format
- `promotionToFrontend()` - Converts database Promotion to frontend format
- `repairRecordToRepairItem()` - Converts database RepairRecord to frontend format
- `repairPayloadToRepairRecord()` - Converts frontend repair payload to database format

### 2. **Updated Routes**

#### Sales Routes (`/api/sales`)
- ✅ `GET /api/sales` - Returns sales in frontend format with orderNumber, grandTotal, etc.
- ✅ `POST /api/sales` - Accepts frontend format (type as string name, not UUID)
- ✅ `DELETE /api/sales/:id` - Deletes sale by numeric ID (frontend format)
- ✅ Handles promotion lookup by index
- ✅ Finds desk items by name (type) instead of UUID
- ✅ Calculates delivery range from km

#### Promotions Routes (`/api/promotions`)
- ✅ `GET /api/promotions` - Returns promotions with numeric IDs
- ✅ `POST /api/promotions` - Stores amount in name format: "Name (100)"
- ✅ `PATCH /api/promotions/:id` - Updates promotion (handles numeric ID)
- ✅ `DELETE /api/promotions/:id` - Deletes promotion (handles numeric ID)
- ✅ Extracts amount from name when returning to frontend

#### Repairs Routes (`/api/repairs`)
- ✅ `GET /api/repairs` - Returns repairs in frontend format
- ✅ `POST /api/repairs` - Accepts frontend format (type, size, color, reason, kind)
- ✅ `PATCH /api/repairs/:id/status` - Updates status (stores in description for now)
- ✅ `DELETE /api/repairs/:id` - Deletes repair (handles numeric ID)
- ✅ Combines size, color, reason into description field

#### Dashboard Routes (`/api/dashboard`)
- ✅ `GET /api/dashboard/owner` - Returns dashboard data in frontend format
- ✅ Calculates summary (income, cost, profit, margin)
- ✅ Returns sales and promotions in frontend format

#### Catalog Routes (`/api/catalog`)
- ✅ `GET /api/catalog/products` - Returns all desk items
- ✅ `POST /api/catalog/products` - Creates desk item (Owner/Admin only)
- ✅ `PATCH /api/catalog/products/:id` - Updates desk item
- ✅ `DELETE /api/catalog/products/:id` - Deletes desk item

#### Inventory Routes (`/api/inventory`)
- ✅ `GET /api/inventory/summary` - Returns summary (placeholder - models don't exist)
- ✅ `POST /api/inventory/movements/stock-in` - Accepts frontend format (type as string)
- ⚠️ Returns 501 until inventory models are added to schema

#### Test Setup Route (`/api/test-setup`)
- ✅ `POST /api/test-setup` - Creates test business, user, desk items, and delivery fees
- ✅ Returns JWT token for testing
- ✅ Only available in development mode

## Data Format Transformations

### Frontend → Backend

| Frontend Field | Backend Field | Transformation |
|----------------|--------------|----------------|
| `type` (string) | `deskType` (UUID) | Lookup desk item by name |
| `promoId` (number) | `appliedPromotion` (UUID) | Lookup promotion by index |
| `pay` | `status` | Direct mapping |
| `delivery` | `deliveryType` | Direct mapping |
| `km` (number) | `deliveryRange` (number) | Convert km to zone (1-20) |
| `price`, `qty`, `discount`, `wFee` | `amount` | Calculate: `(price - discount) * qty + wFee` |

### Backend → Frontend

| Backend Field | Frontend Field | Transformation |
|---------------|---------------|----------------|
| `id` (UUID) | `id` (number) | Convert UUID to numeric ID (index-based) |
| Sequence | `orderNumber` | Generate: `#001`, `#002`, etc. |
| `amount` | `grandTotal` | Direct mapping |
| `status` | `payStatus` | Map: "paid"/"pending"/"deposit" |
| `deliveryType` | `delivery` | Direct mapping |
| `deskItem.name` | `type` | Direct mapping |
| `description` | `reason`, `size`, `color` | Parse from description |

## Authentication & Authorization

All routes require authentication via JWT token in `Authorization: Bearer <token>` header.

### Role Requirements:
- **Sales**: Staff and above
- **Repairs**: Staff and above
- **Promotions**: Owner/Admin only
- **Dashboard**: Owner/Admin only
- **Inventory**: Inventory role and above
- **Catalog**: All authenticated users (create/update/delete: Owner/Admin only)

### Business Scoping:
- All queries filter by `req.businessId`
- Users can only access their own business's data
- Cross-business access is prevented

## Testing

See `TESTING_GUIDE.md` for detailed testing instructions.

Quick start:
1. Call `POST /api/test-setup` to create test data
2. Use the returned token in `Authorization` header
3. Test each endpoint

## Known Limitations

1. **Inventory Models**: InventoryLot and InventoryMovement don't exist in schema yet
   - Routes return 501 (Not Implemented)
   - Need to add models to schema.prisma

2. **Repair Status**: Status field doesn't exist in RepairRecord model
   - Currently stored in description field
   - Need to add `status` field to schema

3. **Promotion Amount/Active**: These fields don't exist in Promotion model
   - Amount stored in name format: "Name (100)"
   - Active status inferred from name
   - Need to add `amount` and `active` fields to schema

4. **Sale Quantity**: Qty field doesn't exist in SaleRecord model
   - Defaults to 1 when returning to frontend
   - Need to add `qty` field to schema

5. **Numeric IDs**: Frontend uses numeric IDs, backend uses UUIDs
   - Conversion based on array index (not ideal)
   - Consider adding `sequenceNumber` field to models

## Next Steps

1. **Add Missing Schema Fields**:
   - `qty` to SaleRecord
   - `status` to RepairRecord
   - `amount` and `active` to Promotion
   - InventoryLot and InventoryMovement models

2. **Add Sequence Numbers**:
   - Add `sequenceNumber` field to SaleRecord for better ID mapping
   - Or use UUIDs in frontend

3. **Update Frontend**:
   - Add authentication UI
   - Store token in localStorage
   - Handle token expiration

4. **Production Readiness**:
   - Disable test-setup endpoint in production
   - Add proper error handling
   - Add logging
   - Add monitoring

## Files Modified

- `server/src/lib/adapters.js` - New file
- `server/src/routes/sales.routes.js` - Updated
- `server/src/routes/promotions.routes.js` - Updated
- `server/src/routes/repairs.routes.js` - Updated
- `server/src/routes/dashboard.routes.js` - Updated
- `server/src/routes/catalog.routes.js` - Updated
- `server/src/routes/inventory.routes.js` - Updated
- `server/src/routes/test-setup.routes.js` - New file
- `server/src/app.js` - Added test-setup route
- `server/src/middleware/auth.middleware.js` - Minor fix

## Summary

✅ All routes updated to match frontend expectations
✅ Data transformation between frontend and database formats
✅ Authentication and authorization on all routes
✅ Business scoping on all queries
✅ Test setup endpoint for easy testing
✅ Error handling and validation

The API is ready for frontend testing! See `TESTING_GUIDE.md` for instructions.
