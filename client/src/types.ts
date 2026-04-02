export type DeliveryMode = "selfpickup" | "delivery";
export type PayStatus = "paid" | "pending" | "deposit";
export type RepairStatus = "open" | "inprogress" | "done";
export type RepairKind = "repair" | "claim";
export type UserRole = "OWNER" | "SALES" | "REPAIRS";
export type StoredFilePurpose = "PAYMENT_SLIP" | "REPAIR_IMAGE";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  /** Tenant owner user id; null for OWNER/ADMIN rows. */
  ownerId?: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  user: AuthUser;
}

export interface StaffMember {
  id: string;
  fullName: string;
  username: string;
  phone?: string | null;
  role: UserRole;
  createdAt: string;
  totalSales: number;
}

export type PromotionAmountType = "fixed" | "percent";

export interface Promotion {
  id: string;
  name: string;
  amountType: PromotionAmountType;
  amount: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  orderNumber: string;
  type: string;
  qty: number;
  price: number;
  grandTotal: number;
  payStatus: PayStatus;
  delivery: DeliveryMode;
  date?: string;
  note?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  paymentSlipImage?: string | null;
  slipViewedAt?: string | null;
  paidAt?: string | null;
  /** ISO timestamp when the sale row was first saved (server `createdAt`). */
  recordedAt?: string | null;
  createdByUserId?: string | null;
  createdByUsername?: string | null;
  createdByName?: string | null;
  /** OWNER-only: mean of recorded purchase ต้นทุน/หน่วย at sale time */
  avgUnitCost?: number;
  /** OWNER-only: COGS for this line */
  cogsTotal?: number;
  /** OWNER-only: (รายได้สินค้า) - COGS */
  grossProfit?: number;
}

/** OWNER-only: คงคลัง + ต้นทุนเฉลี่ยจากค่าที่บันทึกตอนรับของ */
export interface CostPositionRow {
  deskItemId: string;
  name: string;
  onHandQty: number;
  avgUnitCost: number | null;
  /** จำนวนครั้งที่บันทึกต้นทุน (ใช้หาค่าเฉลี่ย) */
  costSampleCount?: number;
}

/** Delivery zone band + fee (from GET /catalog/delivery-fees). */
export interface DeliveryZoneRow {
  range: number;
  minKm: number;
  maxKm: number;
  cost: number;
}

/** REPAIRS-only list: orders with home delivery (minimal fields for drivers). */
export interface DeliveryOrderRow {
  id: string;
  orderNumber: string;
  saleDate: string;
  totalPrice: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  productName: string;
}

export interface RepairItem {
  id: string;
  type: string;
  qty: number;
  size: string;
  color: string;
  reason: string;
  kind: RepairKind;
  status: RepairStatus;
  date: string;
  /** Public image URLs stored in R2 */
  images?: string[];
}

export interface InventorySummaryItem {
  type: string;
  qty: number;
}

export interface ProductItem {
  id: string;
  name: string;
  onsitePrice: number;
  deliveryPrice: number;
}

export interface InventoryMovement {
  id: string;
  type: string;
  qty: number;
  direction: "IN" | "OUT";
  note?: string | null;
  createdAt?: string;
}

/** GET /inventory/lots — owner sees costPerUnit */
export interface InventoryLotRow {
  id: string;
  deskItemId: string;
  productName: string;
  qty: number;
  remainingQty: number;
  costPerUnit?: number;
  note?: string | null;
  createdAt: string;
}

export interface OwnerDashboard {
  summary: {
    /** สะสมทั้งหมด — รายรับจากการขาย */
    income: number;
    /** สะสมทั้งหมด — ต้นทุนสินค้า (COGS) */
    cost: number;
    cogsFromSales: number;
    profit: number;
    margin: number;
  };
  costPositions: CostPositionRow[];
  promotions: Promotion[];
  sales: Sale[];
}

export interface SalesResponse {
  items: Sale[];
}

/** GET /sales/commission-insights — พนักงานขายเท่านั้น */
export interface SalesCommissionInsights {
  applies: boolean;
  role?: UserRole;
  calendarMonth?: number;
  calendarYear?: number;
  monthlyUnitsSold?: number;
  yearlyUnitsSold?: number;
  monthlyCommissionBaht?: number;
  /** จำนวนโต๊ะจนกว่าจะถึงโต๊ะที่ 21 (เริ่มได้คอม 200/ตัว) — null ถ้าเลยแล้ว */
  tablesUntilMonthlyCommission?: number | null;
  yearlyCurrentTier?: { units: number; bonusBaht: number } | null;
  yearlyNextTier?: { units: number; bonusBaht: number } | null;
  tablesUntilYearlyBonus?: number | null;
  encouragementLines?: string[];
}

/** GET /api/reports — owner-class only */
export interface ReportsSummaryResponse {
  month: number;
  year: number;
  summary: {
    orderCount: number;
    grossIncome: number;
    commissionTotal: number;
    netAfterCommissions: number;
  };
}

export interface PromotionsResponse {
  items: Promotion[];
}

export interface RepairsResponse {
  items: RepairItem[];
}

export interface PresignedUploadResponse {
  presignedUrl: string;
  objectKey: string;
  publicFileUrl: string;
  bucketName: string;
}

export interface InventorySummaryResponse {
  summary: InventorySummaryItem[];
  movements: InventoryMovement[];
}

export type PipelineStatus = "planned" | "ordered" | "transit" | "arrived";
export type PipelinePriority = "normal" | "urgent" | "low";

export interface PipelineItem {
  id: string;
  deskItemId: string;
  productName: string;
  qty: number;
  costEst: number;
  expectedDate: string | null;
  note: string | null;
  status: PipelineStatus;
  priority: PipelinePriority;
  createdAt: string;
  updatedAt: string;
}
