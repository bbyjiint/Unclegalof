/**
 * Adapter functions to transform between frontend format and database format
 */

/**
 * Convert database SaleRecord to frontend Sale format
 */
export function saleRecordToSale(saleRecord, sequence = null) {
  const deskItemName = saleRecord.deskItem?.name || saleRecord.deskType || "";

  const orderNumber =
    saleRecord.orderNumber ||
    (sequence !== null ? `SO-${String(sequence + 1).padStart(4, "0")}` : `SO-${saleRecord.id.substring(0, 8).toUpperCase()}`);

  return {
    id: saleRecord.id,
    orderNumber,
    type: deskItemName,
    qty: saleRecord.quantity ?? 1,
    price: saleRecord.unitPrice ?? saleRecord.amount,
    grandTotal: saleRecord.amount,
    payStatus: saleRecord.status === "paid" ? "paid" : saleRecord.status === "pending" ? "pending" : "deposit",
    delivery: saleRecord.deliveryType === "delivery" ? "delivery" : "self",
    date: (saleRecord.saleDate || saleRecord.createdAt)?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
    note: saleRecord.remarks || null,
    paymentSlipImage: saleRecord.paymentSlipImage || null,
    paidAt: saleRecord.paidAt?.toISOString() || null,
  };
}

/**
 * Convert frontend Sale payload to database SaleRecord format
 */
export function salePayloadToSaleRecord(payload, deskItemId) {
  const unitDiscount = (payload.discount || 0) + (payload.manualDisc || 0);
  const unitNet = Math.max(0, (payload.price || 0) - unitDiscount);
  const grandTotal = unitNet * (payload.qty || 1) + (payload.wFee || 0);

  return {
    saleDate: new Date(payload.date),
    deskType: deskItemId,
    quantity: payload.qty || 1,
    unitPrice: payload.price || 0,
    promoDiscount: payload.discount || 0,
    manualDiscount: payload.manualDisc || 0,
    manualDiscountReason: payload.manualReason || null,
    status: payload.pay || "pending",
    appliedPromotion: payload.promoId || null,
    amount: grandTotal,
    deliveryType: payload.delivery || "self",
    deliveryRange: payload.delivery === "delivery" && payload.km ? getDeliveryRangeFromKm(payload.km) : null,
    workerFee: payload.wFee || 0,
    workerFeeType: payload.wType || null,
    customerName: payload.addr || null,
    remarks: payload.note || null,
  };
}

/**
 * Get delivery range (zone) from km
 * Maps km to zone number based on delivery fee table:
 * Zone 1: 1-10 km (Free)
 * Zone 2: 11-15 km (100)
 * Zone 3: 16-29 km (200)
 * Zone 4: 30-39 km (300)
 * Zone 5: 40-49 km (400)
 * Zone 6: 50-59 km (500)
 * Zone 7: 60-79 km (600)
 * Zone 8: 80-99 km (700)
 * Zone 9: 100-109 km (1000)
 * Zone 10: 110-119 km (1100)
 * Zone 11: 120-129 km (1200)
 * Zone 12: 130-139 km (1300)
 * Zone 13: 140-149 km (1400)
 * Zone 14: 150-159 km (1500)
 * Zone 15: 160-169 km (1600)
 * Zone 16: 170-179 km (1700)
 * Zone 17: 180-189 km (1800)
 * Zone 18: 190-199 km (1900)
 * Zone 19: 200-299 km (2000)
 * Zone 20: 300+ km (2500)
 */
function getDeliveryRangeFromKm(km) {
  if (!km || km <= 0) return null;
  if (km <= 10) return 1;      // Free
  if (km <= 15) return 2;      // 100
  if (km <= 29) return 3;      // 200
  if (km <= 39) return 4;      // 300
  if (km <= 49) return 5;      // 400
  if (km <= 59) return 6;      // 500
  if (km <= 79) return 7;      // 600
  if (km <= 99) return 8;      // 700
  if (km <= 109) return 9;    // 1000
  if (km <= 119) return 10;   // 1100
  if (km <= 129) return 11;   // 1200
  if (km <= 139) return 12;   // 1300
  if (km <= 149) return 13;   // 1400
  if (km <= 159) return 14;   // 1500
  if (km <= 169) return 15;   // 1600
  if (km <= 179) return 16;   // 1700
  if (km <= 189) return 17;   // 1800
  if (km <= 199) return 18;   // 1900
  if (km <= 299) return 19;   // 2000
  return 20;                   // 2500
}

/**
 * Convert database Promotion to frontend Promotion format
 */
export function promotionToFrontend(promotion, index = null) {
  return {
    id: promotion.id,
    name: promotion.name,
    amount: promotion.amount ?? 0,
    active: promotion.isActive ?? true,
    createdAt: promotion.createdAt?.toISOString(),
    updatedAt: promotion.updatedAt?.toISOString(),
  };
}

/**
 * Convert database RepairRecord to frontend RepairItem format
 */
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
  };
}

/**
 * Convert frontend Repair payload to database RepairRecord format
 */
export function repairPayloadToRepairRecord(payload, deskItemId, reportedBy) {
  return {
    deskItemId,
    reportedBy,
    reportDate: new Date(payload.date),
    quantity: payload.qty || 1,
    size: payload.size || null,
    color: payload.color || null,
    description: payload.reason || "",
    kind: payload.kind || "repair",
    status: "open",
    amount: 0,
  };
}
