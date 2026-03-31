export type DeliveryMode = "selfpickup" | "delivery";
export type PayStatus = "paid" | "pending" | "deposit";
export type RepairStatus = "open" | "inprogress" | "done";
export type RepairKind = "repair" | "claim";
export type UserRole = "OWNER" | "ADMIN" | "STAFF" | "INVENTORY" | "DELIVERY";

export interface AuthUser {
  id: string;
  email: string;
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
  deliveryAddress?: string | null;
  paymentSlipImage?: string | null;
  paidAt?: string | null;
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
  /** Base64 data URLs (data:image/...) */
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

export interface OwnerDashboard {
  summary: {
    income: number;
    cost: number;
    profit: number;
    margin: number;
  };
  promotions: Promotion[];
  sales: Sale[];
}

export interface SalesResponse {
  items: Sale[];
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
