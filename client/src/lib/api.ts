import type {
  AuthResponse,
  CurrentUserResponse,
  AuthUser,
  StaffMember,
  InventoryLotRow,
  InventorySummaryResponse,
  PresignedUploadResponse,
  ProductItem,
  DeliveryZoneRow,
  OwnerDashboard,
  PipelineItem,
  PipelinePriority,
  PipelineStatus,
  PromotionsResponse,
  RepairsResponse,
  RepairStatus,
  SalesResponse,
  StoredFilePurpose,
  ReportsSummaryResponse,
  SalesCommissionInsights
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://unclegalof-server.vercel.app/api" : "/api");

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

type RegistrationStatusResponse = {
  allowOwnerSignup: boolean;
  allowPublicStaffSignup?: boolean;
};

type StaffListResponse = {
  items: StaffMember[];
};

type CreateStaffPayload = {
  fullName: string;
  username: string;
  password: string;
  phone?: string;
  role: "SALES" | "REPAIRS";
};

type CreatePromotionPayload = {
  name: string;
  amount: number;
  amountType: "fixed" | "percent";
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
  images?: string[];
};

type UploadRepairImagePayload = {
  fileUrl: string;
};

type RemoveRepairImagePayload = {
  fileUrl: string;
};

type AddInventoryStockPayload = {
  type: string;
  qty: number;
  note: string;
};

type InventoryProductPayload = {
  name: string;
  onsitePrice: number;
  deliveryPrice: number;
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
  delivery: "selfpickup" | "delivery";
  km: number | null;
  zoneName: string | null;
  addr: string;
  deliveryAddress: string;
  note: string;
  wFee: number;
  wType: "po" | "ice";
  promoId: string | null;
};

type UploadSalePaymentSlipPayload = {
  fileUrl: string;
};

type PresignUploadPayload = {
  fileName: string;
  contentType: string;
  fileSize: number;
  purpose: StoredFilePurpose;
};

type SaveUploadMetadataPayload = PresignUploadPayload & {
  objectKey: string;
  fileUrl: string;
  bucketName: string;
  originalFileName: string;
};

type UpdateSaleStatusPayload = {
  status: "paid" | "pending" | "deposit";
};

type CreatePipelinePayload = {
  deskItemId: string;
  qty: number;
  costEst?: number;
  date?: string | null;
  note?: string;
  status?: PipelineStatus;
  priority?: PipelinePriority;
};

type UpdatePipelinePayload = Partial<CreatePipelinePayload>;

type RegisterPayload = {
  fullName: string;
  username: string;
  password: string;
  phone?: string;
  role: "OWNER" | "SALES";
};

type LoginPayload = {
  username: string;
  password: string;
};

// Auth token management
export const auth = {
  getToken: () => localStorage.getItem("authToken"),
  setToken: (token: string) => localStorage.setItem("authToken", token),
  clearToken: () => localStorage.removeItem("authToken"),
  getUser: (): AuthUser | null => {
    const raw = localStorage.getItem("authUser");
    return raw ? JSON.parse(raw) as AuthUser : null;
  },
  setUser: (user: AuthUser) => localStorage.setItem("authUser", JSON.stringify(user)),
  clearUser: () => localStorage.removeItem("authUser"),
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = auth.getToken();
  const mergedHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: Array<{ path?: string; message?: string }>;
    };
    const detailMsg =
      Array.isArray(body.details) && body.details.length > 0
        ? body.details.map((d) => d.message).filter(Boolean).join("; ")
        : "";
    throw new Error(detailMsg || body.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  setAuthToken: (token: string) => auth.setToken(token),
  clearAuthToken: () => {
    auth.clearToken();
    auth.clearUser();
  },
  login: (payload: LoginPayload) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: RegisterPayload) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  registrationStatus: () => request<RegistrationStatusResponse>("/auth/bootstrap-status"),
  me: () => request<CurrentUserResponse>("/auth/me"),
  staff: () => request<StaffListResponse>("/auth/staff"),
  createStaff: (payload: CreateStaffPayload) =>
    request<{ user: StaffMember }>("/auth/staff", { method: "POST", body: JSON.stringify(payload) }),
  deleteStaff: (id: string) => request(`/auth/staff/${id}`, { method: "DELETE" }),
  
  // Catalog
  getProducts: () => request<{ items: Array<{ id: string; name: string; onsitePrice: number; deliveryPrice: number }> }>("/catalog/products"),
  deliveryFees: () => request<{ zones: DeliveryZoneRow[] }>("/catalog/delivery-fees"),
  updateDeliveryFees: (items: Array<{ range: number; cost: number }>) =>
    request<{ zones: DeliveryZoneRow[] }>("/catalog/delivery-fees", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
  
  // Promotions
  promotions: () => request<PromotionsResponse>("/promotions"),
  createPromotion: (payload: CreatePromotionPayload) =>
    request("/promotions", { method: "POST", body: JSON.stringify(payload) }),
  togglePromotion: (id: string, active: boolean) =>
    request(`/promotions/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deletePromotion: (id: string) => request(`/promotions/${id}`, { method: "DELETE" }),
  
  // Repairs
  repairs: () => request<RepairsResponse>("/repairs"),
  createRepair: (payload: CreateRepairPayload) =>
    request("/repairs", { method: "POST", body: JSON.stringify(payload) }),
  uploadRepairImage: (id: string, payload: UploadRepairImagePayload) =>
    request(`/repairs/${id}/images`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeRepairImage: (id: string, payload: RemoveRepairImagePayload) =>
    request(`/repairs/${id}/images`, { method: "DELETE", body: JSON.stringify(payload) }),
  updateRepairStatus: (id: string, status: RepairStatus) =>
    request(`/repairs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteRepair: (id: string) => request(`/repairs/${id}`, { method: "DELETE" }),
  
  // Inventory
  inventoryProducts: () => request<{ items: ProductItem[] }>("/inventory/products"),
  createInventoryProduct: (payload: InventoryProductPayload) =>
    request<ProductItem>("/inventory/products", { method: "POST", body: JSON.stringify(payload) }),
  updateInventoryProduct: (id: string, payload: Partial<InventoryProductPayload>) =>
    request<ProductItem>(`/inventory/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventoryProduct: (id: string) => request(`/inventory/products/${id}`, { method: "DELETE" }),
  inventorySummary: () => request<InventorySummaryResponse>("/inventory/summary"),
  addInventoryStock: (payload: AddInventoryStockPayload) =>
    request("/inventory/movements/stock-in", { method: "POST", body: JSON.stringify(payload) }),
  inventoryLots: () => request<{ items: InventoryLotRow[] }>("/inventory/lots"),
  inventoryBatchLots: (payload: {
    note?: string;
    items: Array<{ deskItemId: string; qty: number; costPerUnit: number }>;
  }) =>
    request<{ count: number; lotIds: string[] }>("/inventory/lots/batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateInventoryLotCost: (id: string, payload: { costPerUnit: number }) =>
    request<{ item: InventoryLotRow }>(`/inventory/lots/${id}/cost`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  
  // Sales
  sales: (month: number, year: number) => request<SalesResponse>(`/sales?month=${month}&year=${year}`),
  salesCommissionInsights: () => request<SalesCommissionInsights>("/sales/commission-insights"),
  createSale: (payload: CreateSalePayload) => request("/sales", { method: "POST", body: JSON.stringify(payload) }),
  uploadSalePaymentSlip: (id: string, payload: UploadSalePaymentSlipPayload) =>
    request(`/sales/${id}/payment-slip`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeSalePaymentSlip: (id: string) =>
    request(`/sales/${id}/payment-slip`, { method: "DELETE" }),
  markSaleSlipViewed: (id: string) =>
    request(`/sales/${id}/slip-viewed`, { method: "PATCH" }),
  updateSaleStatus: (id: string, payload: UpdateSaleStatusPayload) =>
    request(`/sales/${id}/status`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSale: (id: string) => request(`/sales/${id}`, { method: "DELETE" }),
  presignUpload: (payload: PresignUploadPayload) =>
    request<PresignedUploadResponse>("/uploads/presign-upload", { method: "POST", body: JSON.stringify(payload) }),
  saveUploadMetadata: (payload: SaveUploadMetadataPayload) =>
    request("/uploads/save-metadata", { method: "POST", body: JSON.stringify(payload) }),
  
  // Dashboard
  ownerDashboard: (month: number, year: number) =>
    request<OwnerDashboard>(`/dashboard/owner?month=${month}&year=${year}`),

  // Sales list alias + reports (tenant-scoped on server)
  orders: (month: number, year: number) => request<SalesResponse>(`/orders?month=${month}&year=${year}`),
  reports: (month: number, year: number) =>
    request<ReportsSummaryResponse>(`/reports?month=${month}&year=${year}`),

  // Pipeline (owner/admin)
  pipeline: () => request<{ items: PipelineItem[] }>("/pipeline"),
  createPipeline: (payload: CreatePipelinePayload) =>
    request<PipelineItem>("/pipeline", { method: "POST", body: JSON.stringify(payload) }),
  updatePipeline: (id: string, payload: UpdatePipelinePayload) =>
    request<PipelineItem>(`/pipeline/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePipeline: (id: string) => request(`/pipeline/${id}`, { method: "DELETE" })
};
