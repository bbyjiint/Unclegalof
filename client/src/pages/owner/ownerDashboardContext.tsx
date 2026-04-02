import { createContext, useContext, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type {
  OwnerDashboard,
  PipelineItem,
  PipelinePriority,
  PipelineStatus,
  PromotionAmountType,
  StaffMember
} from "../../types";

export type PromotionFormState = {
  name: string;
  amountType: PromotionAmountType;
  amount: string;
};

export type PipelineFormState = {
  deskItemId: string;
  qty: string;
  costEst: string;
  expectedDate: string;
  note: string;
  status: PipelineStatus;
  priority: PipelinePriority;
};

export type StaffFormState = {
  fullName: string;
  username: string;
  password: string;
  phone: string;
  role: "SALES" | "REPAIRS";
};

export type OwnerDashboardContextValue = {
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  loadPage: () => Promise<void>;
  dashboard: OwnerDashboard | null;
  month: number;
  year: number;
  setMonth: Dispatch<SetStateAction<number>>;
  setYear: Dispatch<SetStateAction<number>>;
  weekFilter: "all" | "1" | "2" | "3" | "4" | "5";
  setWeekFilter: Dispatch<SetStateAction<"all" | "1" | "2" | "3" | "4" | "5">>;
  payStatusFilter: "all" | "paid" | "pending" | "deposit";
  setPayStatusFilter: Dispatch<SetStateAction<"all" | "paid" | "pending" | "deposit">>;
  sortBy: "time" | "total";
  setSortBy: Dispatch<SetStateAction<"time" | "total">>;
  sortDir: "desc" | "asc";
  setSortDir: Dispatch<SetStateAction<"desc" | "asc">>;
  filteredAndSortedSales: NonNullable<OwnerDashboard["sales"]>;
  statusCount: { paid: number; pending: number; deposit: number };
  selectableYears: number[];
  promotions: NonNullable<OwnerDashboard["promotions"]>;
  promoForm: PromotionFormState;
  setPromoForm: Dispatch<SetStateAction<PromotionFormState>>;
  addPromo: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  togglePromo: (id: string, active: boolean) => Promise<void>;
  deletePromo: (id: string) => Promise<void>;
  pipelineItems: PipelineItem[];
  catalogOptions: Array<{ id: string; name: string }>;
  pipeForm: PipelineFormState;
  setPipeForm: Dispatch<SetStateAction<PipelineFormState>>;
  addPipeline: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updatePipelineRow: (
    id: string,
    patch: Partial<{ status: PipelineStatus; priority: PipelinePriority }>
  ) => Promise<void>;
  removePipelineRow: (id: string) => Promise<void>;
  staffMembers: StaffMember[];
  staffMessage: string | null;
  staffModalOpen: boolean;
  setStaffModalOpen: Dispatch<SetStateAction<boolean>>;
  staffForm: StaffFormState;
  setStaffForm: Dispatch<SetStateAction<StaffFormState>>;
  staffSubmitting: boolean;
  staffDeletingId: string | null;
  createStaffAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  removeStaffAccount: (staff: StaffMember) => Promise<void>;
  confirmSalePaid: (id: string) => Promise<void>;
  viewPaymentSlipAndMark: (saleId: string, imageSrc: string) => Promise<void>;
  removePaymentSlipByOwner: (saleId: string) => Promise<void>;
  updatingSaleId: string | null;
  slipPreviewSrc: string | null;
  closeSlipPreview: () => void;
};

const OwnerDashboardContext = createContext<OwnerDashboardContextValue | null>(null);

export function useOwnerDashboard(): OwnerDashboardContextValue {
  const ctx = useContext(OwnerDashboardContext);
  if (!ctx) {
    throw new Error("useOwnerDashboard must be used within OwnerDashboardLayout");
  }
  return ctx;
}

export { OwnerDashboardContext };
