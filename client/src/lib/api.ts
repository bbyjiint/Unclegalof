import type {
  InventorySummaryResponse,
  OwnerDashboard,
  PromotionsResponse,
  RepairsResponse,
  RepairStatus,
  SalesResponse
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type CreatePromotionPayload = {
  name: string;
  amount: number;
  active?: boolean;
};

type CreateRepairPayload = {
  type: string;
  qty: number;
  size: string;
  color: string;
  reason: string;
  kind: "repair" | "claim";
  date: string;
};

type AddInventoryStockPayload = {
  type: string;
  qty: number;
  note: string;
};

type CreateSalePayload = {
  date: string;
  type: string;
  qty: number;
  price: number;
  pay: "paid" | "pending" | "deposit";
  discount: number;
  manualDisc: number;
  manualReason: string;
  delivery: "self" | "delivery";
  km: number | null;
  zoneName: string | null;
  addr: string;
  note: string;
  wFee: number;
  wType: "po" | "ice";
  promoId: number | null;
};

// Auth token management
export const auth = {
  getToken: () => localStorage.getItem("authToken"),
  setToken: (token: string) => localStorage.setItem("authToken", token),
  clearToken: () => localStorage.removeItem("authToken"),
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = auth.getToken();
  
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

export const api = {
  // Auth
  setAuthToken: (token: string) => auth.setToken(token),
  clearAuthToken: () => auth.clearToken(),
  
  // Catalog
  getProducts: () => request<{ items: Array<{ id: string; name: string; onsitePrice: number; deliveryPrice: number }> }>("/catalog/products"),
  
  // Promotions
  promotions: () => request<PromotionsResponse>("/promotions"),
  createPromotion: (payload: CreatePromotionPayload) =>
    request("/promotions", { method: "POST", body: JSON.stringify(payload) }),
  togglePromotion: (id: number, active: boolean) =>
    request(`/promotions/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deletePromotion: (id: number) => request(`/promotions/${id}`, { method: "DELETE" }),
  
  // Repairs
  repairs: () => request<RepairsResponse>("/repairs"),
  createRepair: (payload: CreateRepairPayload) =>
    request("/repairs", { method: "POST", body: JSON.stringify(payload) }),
  updateRepairStatus: (id: number, status: RepairStatus) =>
    request(`/repairs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteRepair: (id: number) => request(`/repairs/${id}`, { method: "DELETE" }),
  
  // Inventory
  inventorySummary: () => request<InventorySummaryResponse>("/inventory/summary"),
  addInventoryStock: (payload: AddInventoryStockPayload) =>
    request("/inventory/movements/stock-in", { method: "POST", body: JSON.stringify(payload) }),
  
  // Sales
  sales: (month: number, year: number) => request<SalesResponse>(`/sales?month=${month}&year=${year}`),
  createSale: (payload: CreateSalePayload) => request("/sales", { method: "POST", body: JSON.stringify(payload) }),
  deleteSale: (id: number) => request(`/sales/${id}`, { method: "DELETE" }),
  
  // Dashboard
  ownerDashboard: (month: number, year: number) =>
    request<OwnerDashboard>(`/dashboard/owner?month=${month}&year=${year}`)
};
