function legacyIceFeeToDeduct(saleRecord) {
  const isLegacySelfPickupIceFee =
    saleRecord?.deliveryType === "selfpickup" &&
    saleRecord?.workerFeeType === "ice" &&
    Number(saleRecord?.workerFee || 0) > 0;
  return isLegacySelfPickupIceFee ? Number(saleRecord.workerFee || 0) : 0;
}

function normalizedLineGrandTotal(saleRecord) {
  return Math.max(0, Number(saleRecord.amount || 0) - legacyIceFeeToDeduct(saleRecord));
}

function formatSaleDate(value) {
  return value?.toISOString?.().split("T")[0] || new Date().toISOString().split("T")[0];
}

function toIsoOrNull(value) {
  return value?.toISOString?.() || null;
}

const SALE_PHOTO_BLOCK_START = "[SALE_PHOTOS]";
const SALE_PHOTO_BLOCK_END = "[/SALE_PHOTOS]";

function normalizePhotoUrls(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((url) => typeof url === "string").map((url) => url.trim()).filter(Boolean);
}

function photoUrlsFromNote(rawNote) {
  const source = String(rawNote ?? "");
  const start = source.indexOf(SALE_PHOTO_BLOCK_START);
  const end = source.indexOf(SALE_PHOTO_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    return [];
  }
  return source
    .slice(start + SALE_PHOTO_BLOCK_START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniquePhotoUrls(...groups) {
  return Array.from(new Set(groups.flatMap((group) => normalizePhotoUrls(group))));
}

function toLineItem(row) {
  return {
    id: row.id,
    deskItemId: row.deskType,
    type: row.deskItem?.name || row.deskType || "",
    qty: row.quantity ?? 1,
    price: row.unitPrice ?? 0,
    grandTotal: normalizedLineGrandTotal(row),
    deskPhotos: normalizePhotoUrls(row.deskPhotos),
  };
}

function summarizeLineTypes(lineItems) {
  return Array.from(new Set(lineItems.map((item) => item.type).filter(Boolean))).join(", ");
}

function groupDateValue(order, row) {
  return order?.createdAt?.getTime?.() ?? row?.createdAt?.getTime?.() ?? 0;
}

export const saleRecordFrontendInclude = {
  promotion: true,
  deskItem: true,
  deliveryFee: true,
  paymentBatch: true,
  salesOrder: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
    },
  },
};

export function saleGroupToFrontendSale(group, options = {}) {
  const rows = [...group.rows].sort((a, b) => {
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return (a.deskItem?.name || "").localeCompare(b.deskItem?.name || "");
  });
  const first = rows[0];
  if (!first) {
    return null;
  }

  const order = group.salesOrder;
  const lineItems = rows.map(toLineItem);
  const qty = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const subtotal = rows.reduce((sum, row) => sum + Number(row.unitPrice || 0) * Number(row.quantity || 0), 0);
  const grandTotal =
    order?.grandTotal != null
      ? Math.max(0, Number(order.grandTotal || 0))
      : rows.reduce((sum, row) => sum + normalizedLineGrandTotal(row), 0);
  const totalCogs = rows.reduce((sum, row) => sum + Number(row.cogsTotal || 0), 0);
  const totalGrossProfit = rows.reduce((sum, row) => sum + Number(row.grossProfit || 0), 0);
  const deskPhotos = uniquePhotoUrls(
    order?.deskPhotos,
    ...rows.map((row) => row.deskPhotos),
    photoUrlsFromNote(order?.remarks),
    photoUrlsFromNote(first.remarks)
  );

  const base = {
    id: first.id,
    orderNumber: order?.orderNumber || first.orderNumber,
    type: order ? summarizeLineTypes(lineItems) : first.deskItem?.name || first.deskType || "",
    qty,
    price: order?.subtotal ?? subtotal,
    grandTotal,
    payStatus: order?.status || first.status || "pending",
    delivery: order?.deliveryType || first.deliveryType || "selfpickup",
    date: formatSaleDate(order?.saleDate || first.saleDate || first.createdAt),
    note: order?.remarks ?? first.remarks ?? null,
    customerName: order?.customerName ?? first.customerName ?? null,
    customerPhone: order?.customerPhone ?? first.customerPhone ?? null,
    deliveryCompletedAt: toIsoOrNull(order?.deliveryCompletedAt || first.deliveryCompletedAt),
    deliveryAddress: order?.deliveryAddress ?? first.deliveryAddress ?? null,
    deskPhotos,
    paymentSlipImage: order?.paymentSlipImage ?? first.paymentSlipImage ?? null,
    slipViewedAt: toIsoOrNull(order?.slipViewedAt || first.slipViewedAt),
    paidAt: toIsoOrNull(order?.paidAt || first.paidAt),
    recordedAt: toIsoOrNull(order?.createdAt || first.createdAt),
    createdByUserId: order?.createdBy?.id || order?.createdByUserId || first.createdBy?.id || first.createdByUserId || null,
    createdByUsername: order?.createdBy?.username || first.createdBy?.username || null,
    createdByName: order?.createdBy?.fullName || first.createdBy?.fullName || null,
    paymentBatchId: first.paymentBatch?.id || first.paymentBatchId || null,
    paymentBatchNumber: first.paymentBatch?.batchNumber || null,
    paymentBatchTotalAmount: first.paymentBatch?.totalAmount ?? null,
    items: lineItems,
    salesOrderId: order?.id || first.salesOrderId || null,
  };

  if (options.includeCost) {
    base.avgUnitCost = qty > 0 ? Math.round(totalCogs / qty) : 0;
    base.cogsTotal = totalCogs;
    base.grossProfit = totalGrossProfit;
  }

  return base;
}

export function saleRecordsToFrontendSales(saleRecords, options = {}) {
  const groups = new Map();

  for (const row of saleRecords) {
    const key = row.salesOrderId || row.id;
    if (!groups.has(key)) {
      groups.set(key, {
        salesOrder: row.salesOrder || null,
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }

  return Array.from(groups.values())
    .map((group) => saleGroupToFrontendSale(group, options))
    .filter(Boolean)
    .sort((a, b) => {
      const groupA = groups.get(a.salesOrderId || a.id);
      const groupB = groups.get(b.salesOrderId || b.id);
      return groupDateValue(groupB?.salesOrder, groupB?.rows?.[0]) - groupDateValue(groupA?.salesOrder, groupA?.rows?.[0]);
    });
}

export async function expandLogicalSaleIds(prisma, ids) {
  const uniqueIds = [...new Set(ids)];
  const saleRecords = [];
  const missingIds = [];

  for (const id of uniqueIds) {
    const sale = await prisma.saleRecord.findUnique({
      where: { id },
      include: {
        paymentBatch: true,
        createdBy: { select: { id: true } },
      },
    });
    if (sale) {
      if (sale.salesOrderId) {
        const groupedRows = await prisma.saleRecord.findMany({
          where: { salesOrderId: sale.salesOrderId },
          include: {
            paymentBatch: true,
            createdBy: { select: { id: true } },
          },
        });
        saleRecords.push(...groupedRows);
      } else {
        saleRecords.push(sale);
      }
      continue;
    }

    missingIds.push(id);
  }

  const dedupedRecords = Array.from(new Map(saleRecords.map((sale) => [sale.id, sale])).values());
  return {
    saleRecords: dedupedRecords,
    missingIds,
    logicalCount: uniqueIds.length - missingIds.length,
  };
}
