/**
 * Adapter functions to transform between frontend format and database format
 */

/**
 * Convert database SaleRecord to frontend Sale format
 */
export function saleRecordToSale(saleRecord, sequence = null) {
  const deskItemName = saleRecord.deskItem?.name || saleRecord.deskType || "";
  
  // Generate orderNumber from sequence or use first 8 chars of UUID
  const orderNumber = sequence !== null 
    ? `#${String(sequence + 1).padStart(3, "0")}`
    : `#${saleRecord.id.substring(0, 8).toUpperCase()}`;
  
  // Calculate grandTotal (amount includes everything in current schema)
  // If we need to separate, we'd need to store more fields
  const grandTotal = saleRecord.amount;
  
  return {
    id: sequence !== null ? sequence + 1 : parseInt(saleRecord.id.replace(/-/g, "").substring(0, 8), 16) % 1000000,
    orderNumber,
    type: deskItemName,
    qty: 1, // Default since schema doesn't have qty
    price: saleRecord.amount,
    grandTotal,
    payStatus: saleRecord.status === "paid" ? "paid" : saleRecord.status === "pending" ? "pending" : "deposit",
    delivery: saleRecord.deliveryType === "delivery" ? "delivery" : "self",
    date: saleRecord.createdAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
    note: saleRecord.remarks || null,
  };
}

/**
 * Convert frontend Sale payload to database SaleRecord format
 */
export function salePayloadToSaleRecord(payload, businessId, deskItemId) {
  // Calculate amount from price, qty, discounts, and worker fee
  const unitDiscount = (payload.discount || 0) + (payload.manualDisc || 0);
  const unitNet = Math.max(0, (payload.price || 0) - unitDiscount);
  const grandTotal = unitNet * (payload.qty || 1) + (payload.wFee || 0);
  
  // Handle promoId - it might be a number (index) or UUID string
  let appliedPromotion = null;
  if (payload.promoId) {
    // If it's a number, we'll need to look it up by index
    // If it's a UUID string, use it directly
    appliedPromotion = typeof payload.promoId === "string" && payload.promoId.includes("-") 
      ? payload.promoId 
      : null; // Will be looked up by index in route
  }
  
  return {
    businessId,
    deskType: deskItemId,
    status: payload.pay || "pending",
    appliedPromotion,
    amount: grandTotal,
    deliveryType: payload.delivery || "self",
    deliveryRange: payload.delivery === "delivery" && payload.km ? getDeliveryRangeFromKm(payload.km) : null,
    remarks: payload.note || payload.manualReason || null,
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
  // Try to extract amount from name if it's in format "Name (100)" or "Name - 100"
  let amount = 0;
  const amountMatch = promotion.name.match(/[(\-]\s*(\d+)\s*[)\-]/);
  if (amountMatch) {
    amount = parseInt(amountMatch[1], 10);
  }
  
  // Check if name contains "inactive" or similar to determine active status
  const active = !promotion.name.toLowerCase().includes("inactive");
  
  return {
    id: index !== null ? index + 1 : parseInt(promotion.id.replace(/-/g, "").substring(0, 8), 16) % 1000000,
    name: promotion.name.replace(/\s*[(\-]\s*\d+\s*[)\-]\s*/g, "").replace(/\s*\(inactive\)/gi, ""), // Remove amount from name
    amount,
    active,
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
    id: index !== null ? index + 1 : parseInt(repairRecord.id.replace(/-/g, "").substring(0, 8), 16) % 1000000,
    type: deskItemName,
    qty: 1, // Default since schema doesn't have qty
    size: "", // Schema doesn't have size - stored in description
    color: "", // Schema doesn't have color - stored in description
    reason: repairRecord.description,
    kind: "repair", // Schema doesn't have kind - default to repair
    status: "open", // Schema doesn't have status - default to open
    date: repairRecord.createdAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
  };
}

/**
 * Convert frontend Repair payload to database RepairRecord format
 */
export function repairPayloadToRepairRecord(payload, businessId, deskItemId, reportedBy) {
  // Combine size, color, reason into description
  const descriptionParts = [];
  if (payload.size) descriptionParts.push(`ขนาด: ${payload.size}`);
  if (payload.color) descriptionParts.push(`สี: ${payload.color}`);
  if (payload.reason) descriptionParts.push(`สาเหตุ: ${payload.reason}`);
  if (payload.kind) descriptionParts.push(`ประเภท: ${payload.kind}`);
  
  const description = descriptionParts.join(" | ") || payload.reason || "";
  
  return {
    businessId,
    deskItemId,
    reportedBy,
    description,
    amount: 0, // Default amount
  };
}
