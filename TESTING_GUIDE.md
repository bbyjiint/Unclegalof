# Testing Guide - Frontend API Integration

This guide explains how to test the frontend with the database API.

## Prerequisites

1. **Database Setup**: Make sure your Neon database is configured and Prisma migrations are run:
   ```bash
   cd server
   npx prisma migrate dev
   ```

2. **Environment Variables**: Set up your `.env` file in the `server/` directory:
   ```env
   DATABASE_URL="postgresql://..."
   JWT_SECRET="your-secret-key"
   PORT=4000
   CLIENT_ORIGIN="http://localhost:5173"
   ```

3. **Start the Server**:
   ```bash
   cd server
   npm start
   ```

4. **Start the Frontend** (in another terminal):
   ```bash
   cd client
   npm run dev
   ```

## Step 1: Setup Test Data

First, you need to create a test business, user, and default data (desk items, delivery fees).

### Option A: Using Test Setup Endpoint (Recommended)

Call the test setup endpoint to automatically create everything:

```bash
curl -X POST http://localhost:4000/api/test-setup
```

This will return:
```json
{
  "success": true,
  "message": "Test setup complete",
  "user": {
    "id": "...",
    "email": "test@example.com",
    "fullName": "Test User"
  },
  "business": {
    "id": "...",
    "name": "Test Business"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token** - you'll need it for API requests.

### Option B: Manual Setup

1. Register a user via `/api/auth/register`
2. Create desk items via `/api/catalog/products`
3. Create delivery fees manually

## Step 2: Configure Frontend Authentication

The frontend needs to send the JWT token with each request. Update `client/src/lib/api.ts` to include the token:

```typescript
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('authToken'); // Get token from storage
  
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

Then store the token after test setup:
```typescript
// After calling test-setup endpoint
localStorage.setItem('authToken', response.token);
```

## Step 3: Test Each Feature

### Sales (Staff Page)

1. **Create a Sale**:
   - Go to Staff page
   - Fill in sale form
   - Submit
   - Should create a sale record

2. **View Sales**:
   - Sales list should show all sales for current month
   - Each sale should have orderNumber, type, qty, grandTotal

3. **Delete Sale**:
   - Click delete button on a sale
   - Should remove it from database

### Promotions (Owner Page)

1. **Create Promotion**:
   - Go to Owner page
   - Fill in promotion form (name, amount)
   - Submit
   - Should create a promotion

2. **Toggle Promotion**:
   - Click toggle button
   - Should update promotion status

3. **Delete Promotion**:
   - Click delete button
   - Should remove promotion

### Repairs (Repair Page)

1. **Create Repair**:
   - Go to Repair page
   - Fill in repair form
   - Submit
   - Should create a repair record

2. **Update Status**:
   - Click status buttons (open → inprogress → done)
   - Should update repair status

3. **Delete Repair**:
   - Click delete button
   - Should remove repair record

### Inventory (Inventory Page)

**Note**: Inventory models don't exist in schema yet. The endpoint will return a 501 error with a message.

### Dashboard (Owner Page)

1. **View Dashboard**:
   - Go to Owner page
   - Should show:
     - Summary (income, cost, profit, margin)
     - Promotions list
     - Sales list

## API Endpoints Reference

### Authentication Required
All endpoints (except `/api/health` and `/api/auth/*`) require authentication.

Include header: `Authorization: Bearer <token>`

### Endpoints

- `GET /api/sales?month=1&year=2024` - Get sales for month/year
- `POST /api/sales` - Create a sale
- `DELETE /api/sales/:id` - Delete a sale

- `GET /api/promotions` - Get all promotions
- `POST /api/promotions` - Create promotion (Owner/Admin only)
- `PATCH /api/promotions/:id` - Update promotion (Owner/Admin only)
- `DELETE /api/promotions/:id` - Delete promotion (Owner/Admin only)

- `GET /api/repairs` - Get all repairs
- `POST /api/repairs` - Create repair
- `PATCH /api/repairs/:id/status` - Update repair status
- `DELETE /api/repairs/:id` - Delete repair

- `GET /api/inventory/summary` - Get inventory summary (Inventory role)
- `POST /api/inventory/movements/stock-in` - Add stock (Inventory role)

- `GET /api/dashboard/owner?month=1&year=2024` - Owner dashboard (Owner/Admin only)

- `GET /api/catalog/products` - Get all desk items
- `POST /api/catalog/products` - Create desk item (Owner/Admin only)

- `POST /api/test-setup` - Setup test data (development only)

## Data Format Differences

### Frontend → Backend

The frontend sends data in a different format than the database expects. The routes handle the transformation:

- **Sales**: Frontend sends `type` (string name), backend stores `deskType` (UUID)
- **Promotions**: Frontend sends `amount` and `active`, backend only has `name` (amount stored in name)
- **Repairs**: Frontend sends `type`, `size`, `color`, `reason`, backend stores combined in `description`
- **IDs**: Frontend uses numeric IDs (1, 2, 3...), backend uses UUIDs

### Backend → Frontend

The adapters transform database records to match frontend expectations:

- UUIDs converted to numeric IDs (based on index)
- `orderNumber` generated from sequence
- `grandTotal` calculated from `amount`
- `status` mapped from database values

## Troubleshooting

### 401 Unauthorized
- Check that you're sending the `Authorization` header
- Verify the token is valid (not expired)
- Make sure you called `/api/test-setup` first

### 404 Not Found
- For sales/repairs: Make sure the desk item exists in catalog
- For promotions: Check that promotion exists for this business

### 403 Forbidden
- Check user role - some endpoints require Owner/Admin
- Verify business access - user must belong to the business

### 501 Not Implemented
- Inventory and Pipeline endpoints return this until models are added to schema

## Next Steps

1. **Add Inventory Models**: Update `schema.prisma` to add `InventoryLot` and `InventoryMovement` models
2. **Add Status Field**: Add `status` field to `RepairRecord` model
3. **Add Amount Field**: Add `amount` field to `Promotion` model
4. **Add Active Field**: Add `active` boolean to `Promotion` model
5. **Update Frontend**: Add authentication UI (login form, token storage)

## Notes

- The test setup endpoint creates default desk items matching the frontend's `PRODUCT_TYPES`
- Delivery fees are created for zones 1-20
- Test user has OWNER role, so can access all endpoints
- All data is scoped to the test business - users can't see other businesses' data
