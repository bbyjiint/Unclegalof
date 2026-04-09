/**
 * Adapter functions to transform between frontend format and database format
 */

import { getDeliveryRangeFromKm } from "./deliveryZones.js";

const VALID_SALE_STATUSES = new Set(["paid", "pending", "deposit"]);
const VALID_DELIVERY_METHODS = new Set(["selfpickup", "delivery"]);

function legacyIceFeeToDeduct(saleRecord) {
  const isLegacySelfPickupIceFee =
    saleRecord?.deliveryType === "selfpickup" &&
    saleRecord?.workerFeeType === "ice" &&
    Number(saleRecord?.workerFee || 0) > 0;
  return isLegacySelfPickupIceFee ? Number(saleRecord.workerFee || 0) : 0;
}

/** Thai mobile: exactly 10 digits, leading 0 (e.g. 0812345678). Strips spaces/dashes. */
export function normalizeCustomerPhoneThai10(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  return /^0\d{9}$/.test(d) ? d : null;
}

/**
 * Convert database SaleRecord to frontend Sale format
 * @param {{ includeCost?: boolean }} [options] — OWNER only: include ต้นทุน / COGS / gross profit
 */
export function saleRecordToSale(saleRecord, sequence = null, options = {}) {
  const deskItemName = saleRecord.deskItem?.name || saleRecord.deskType || "";

  const orderNumber =
    saleRecord.orderNumber ||
    (sequence !== null ? `SO-${String(sequence + 1).padStart(4, "0")}` : `SO-${saleRecord.id.substring(0, 8).toUpperCase()}`);

  const payStatus = VALID_SALE_STATUSES.has(saleRecord.status) ? saleRecord.status : "pending";
  const delivery = VALID_DELIVERY_METHODS.has(saleRecord.deliveryType) ? saleRecord.deliveryType : "selfpickup";

  const grandTotal = Number(saleRecord.amount || 0) - legacyIceFeeToDeduct(saleRecord);

  const base = {
    id: saleRecord.id,
    orderNumber,
    type: deskItemName,
    qty: saleRecord.quantity ?? 1,
    price: saleRecord.unitPrice ?? saleRecord.amount,
    grandTotal: Math.max(0, grandTotal),
    payStatus,
    delivery,
    date: (saleRecord.saleDate || saleRecord.createdAt)?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
    note: saleRecord.remarks || null,
    customerName: saleRecord.customerName || null,
    customerPhone: saleRecord.customerPhone || null,
    deliveryCompletedAt: saleRecord.deliveryCompletedAt?.toISOString() || null,
    deliveryAddress: saleRecord.deliveryAddress || null,
    paymentSlipImage: saleRecord.paymentSlipImage || null,
    slipViewedAt: saleRecord.slipViewedAt?.toISOString() || null,
    paidAt: saleRecord.paidAt?.toISOString() || null,
    /** When the sale record was first saved (audit). */
    recordedAt: saleRecord.createdAt?.toISOString() || null,
    createdByUserId: saleRecord.createdBy?.id || saleRecord.createdByUserId || null,
    createdByUsername: saleRecord.createdBy?.username || null,
    createdByName: saleRecord.createdBy?.fullName || null,
    paymentBatchId: saleRecord.paymentBatch?.id || saleRecord.paymentBatchId || null,
    paymentBatchNumber: saleRecord.paymentBatch?.batchNumber || null,
    paymentBatchTotalAmount: saleRecord.paymentBatch?.totalAmount ?? null,
  };

  if (options.includeCost) {
    base.avgUnitCost = saleRecord.avgUnitCostSnapshot ?? 0;
    base.cogsTotal = saleRecord.cogsTotal ?? 0;
    base.grossProfit = saleRecord.grossProfit ?? 0;
  }

  return base;
}

/**
 * Convert frontend Sale payload to database SaleRecord format
 * @param companyOwnerId FK anchor — use getCanonicalCompanyOwnerId() for single-company mode
 */
export function salePayloadToSaleRecord(payload, deskItemId, companyOwnerId) {
  const unitDiscount = (payload.discount || 0) + (payload.manualDisc || 0);
  const unitNet = Math.max(0, (payload.price || 0) - unitDiscount);
  const grandTotal = unitNet * (payload.qty || 1) + (payload.wFee || 0);

  const status = VALID_SALE_STATUSES.has(payload.pay) ? payload.pay : "pending";
  const deliveryType = VALID_DELIVERY_METHODS.has(payload.delivery) ? payload.delivery : "selfpickup";

  return {
    ownerId: companyOwnerId,
    saleDate: new Date(payload.date),
    deskType: deskItemId,
    quantity: payload.qty || 1,
    unitPrice: payload.price || 0,
    promoDiscount: payload.discount || 0,
    manualDiscount: payload.manualDisc || 0,
    manualDiscountReason: payload.manualReason || null,
    status,
    appliedPromotion: payload.promoId || null,
    amount: grandTotal,
    deliveryType,
    deliveryRange: deliveryType === "delivery" && payload.km ? getDeliveryRangeFromKm(payload.km) : null,
    workerFee: payload.wFee || 0,
    workerFeeType: payload.wType || null,
    customerName: payload.addr || null,
    customerPhone: normalizeCustomerPhoneThai10(payload.customerPhone),
    deliveryAddress: String(payload.deliveryAddress ?? "").trim() || null,
    remarks: payload.note || null,
  };
}

/**
 * Convert database Promotion to frontend Promotion format
 */
export function promotionToFrontend(promotion, index = null) {
  return {
    id: promotion.id,
    name: promotion.name,
    amountType: promotion.amountType === "percent" ? "percent" : "fixed",
    amount: promotion.amount ?? 0,
    active: promotion.isActive ?? true,
    createdAt: promotion.createdAt?.toISOString(),
    updatedAt: promotion.updatedAt?.toISOString(),
  };
}

/**
 * Convert database RepairRecord to frontend RepairItem format
 */
function normalizeRepairImages(value) {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value;
  }
  return [];
}

export function repairRecordToRepairItem(repairRecord, index = null) {
  const deskItemName = repairRecord.deskItem?.name || repairRecord.deskItemId || "";

  return {
    id: repairRecord.id,
    type: deskItemName,
    qty: repairRecord.quantity ?? 1,
    size: repairRecord.size || "",
    color: repairRecord.color || "",
    reason: repairRecord.description,
    kind: repairRecord.kind === "claim" ? "claim" : "repair",
    status: repairRecord.status === "inprogress" || repairRecord.status === "done" ? repairRecord.status : "open",
    date: (repairRecord.reportDate || repairRecord.createdAt)?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
    images: normalizeRepairImages(repairRecord.images),
  };
}

