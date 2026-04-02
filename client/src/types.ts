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
  deliveryAddress?: string | null;
  paymentSlipImage?: string | null;
  slipViewedAt?: string | null;
  paidAt?: string | null;
  createdByUserId?: string | null;
  createdByUsername?: string | null;
  createdByName?: string | null;
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
