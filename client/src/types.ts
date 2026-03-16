export type DeliveryMode = "self" | "delivery";
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
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  user: AuthUser;
}

export interface Promotion {
  id: string;
  name: string;
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
}

export interface InventorySummaryItem {
  type: string;
  qty: number;
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

export interface InventorySummaryResponse {
  summary: InventorySummaryItem[];
  movements: InventoryMovement[];
}
