export type DeliveryMode = "selfpickup" | "delivery";
export type PayStatus = "paid" | "pending" | "deposit";
export type RepairStatus = "open" | "inprogress" | "done";
export type RepairKind = "repair" | "claim";
export type UserRole = "OWNER" | "SALES" | "REPAIRS";
export type StoredFilePurpose = "PAYMENT_SLIP" | "REPAIR_IMAGE" | "SALE_IMAGE" | "DELIVERY_PROOF";

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
  salesOrderId?: string | null;
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
  /** ออเดอร์จัดส่ง: เวลาที่กดยืนยันจัดส่งสำเร็จ (ISO) */
  deliveryCompletedAt?: string | null;
  deliveryAddress?: string | null;
  deskPhotos?: string[];
  paymentSlipImage?: string | null;
  slipViewedAt?: string | null;
  paidAt?: string | null;
  /** ISO timestamp when the sale row was first saved (server `createdAt`). */
  recordedAt?: string | null;
  createdByUserId?: string | null;
  createdByUsername?: string | null;
  createdByName?: string | null;
  paymentBatchId?: string | null;
  paymentBatchNumber?: string | null;
  paymentBatchTotalAmount?: number | null;
  items?: Array<{
    id: string;
    deskItemId: string;
    type: string;
    qty: number;
    price: number;
    grandTotal: number;
    deskPhotos?: string[];
  }>;
  /** OWNER-only: mean of recorded purchase ต้นทุน/หน่วย at sale time */
  avgUnitCost?: number;
  /** OWNER-only: COGS for this line */
  cogsTotal?: number;
  /** OWNER-only: (รายได้สินค้า) - COGS */
  grossProfit?: number;
  /** ค่าจัดส่ง (ลูกค้าจ่าย) — เท่ากับ workerDistanceFee เมื่อจัดส่ง / 0 เมื่อรับเอง */
  deliveryFee?: number;
  /** เมื่อมี includeCost — มีบรรทัดในออเดอร์ที่รอกรอก FIFO แล้ว */
  costStatus?: "confirmed" | "pending_owner_review";
  /** ค่ายก/แบกของพนักงานต่อออเดอร์ (รวมทุกบรรทัด) */
  workerLiftFee?: number;
  /** ค่าจัดส่งระยะทางที่จ่ายให้พนักงาน (เท่ากับค่าจัดส่งของลูกค้าเมื่อจัดส่ง) */
  workerDistanceFee?: number;
  /** ค่าตอบแทนพนักงานรวม = workerLiftFee + workerDistanceFee */
  employeePayout?: number;
  /** รายได้สุทธิเจ้าของกิจการ = grandTotal − employeePayout */
  ownerNet?: number;
}

/** One active inventory lot in FIFO order */
export interface InventoryLotPosition {
  id: string;
  remainingQty: number;
  costPerUnit: number;
  /** remainingQty × costPerUnit; 0 when costPerUnit is 0 */
  totalValue: number;
  receivedAt: string;
  note: string | null;
}

/** OWNER-only: per-product list of active lots in FIFO order (oldest = next to be consumed) */
export interface CostPositionRow {
  deskItemId: string;
  name: string;
  onHandQty: number;
  /** Units in lots with costPerUnit = 0 — awaiting owner cost entry */
  pendingQty: number;
  lots: InventoryLotPosition[];
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
  deliveryCompletedAt?: string | null;
  totalPrice: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  productName: string;
  deliveryProofImage?: string | null;
  deliveryAcknowledgedAt?: string | null;
  deskPhotos?: string[];
  items?: Array<{
    id: string;
    deskItemId: string;
    type: string;
    qty: number;
    price: number;
    grandTotal: number;
    deskPhotos?: string[];
  }>;
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
  /** Owner-only: number of consumed-lot records still carrying costPerUnitAtSale = 0 for this lot */
  pendingOrderCount?: number;
  note?: string | null;
  createdAt: string;
}

/** One sale line awaiting owner cost entry */
export interface PendingCostOrder {
  id: string;
  /** Base order number (e.g. SO-202601-0001), without line suffix */
  orderNumber: string;
  productName: string;
  qty: number;
  amount: number;
  saleDate: string;
  /** Each consumed lot that still has costPerUnitAtSale = 0; null receivedAt = unallocated stock */
  pendingLots: Array<{ consumedQty: number; receivedAt: string | null }>;
}

export interface OwnerDashboard {
  summary: {
    /** รายรับทั้งหมด — ทุก order รวม pending cost */
    income: number;
    /** COGS จาก confirmed-cost orders เท่านั้น */
    cost: number;
    cogsFromSales: number;
    /** กำไร = confirmedIncome − COGS (ไม่รวม pending-cost orders) */
    profit: number;
    margin: number;
    /** จำนวนบรรทัดที่รอเจ้าของกรอกต้นทุน */
    pendingCostLineCount: number;
    /** รายรับรวมของ pending-cost orders */
    pendingCostRevenue: number;
    /** ค่าใช้จ่ายจ่ายให้พนักงาน — เดือนที่เลือก (จากคอมมิชัน + ค่ายก + ค่าส่งให้พนักงาน) */
    staffExpenses: {
      salesCommission: number;
      liftingFees: number;
      deliveryWorkerFees: number;
      total: number;
    };
    /** กำไรรวม (ยืนยันต้นทุนแล้ว) − ค่าใช้จ่ายพนักงานในเดือน */
    ownerNetIncome: number;
  };
  /** แต่ละบรรทัดขายที่ costStatus = pending_owner_review สำหรับเดือนที่เลือก */
  pendingCostOrders: PendingCostOrder[];
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
