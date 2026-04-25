import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner, requireSales } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { normalizeCustomerPhoneThai10 } from "../lib/adapters.js";
import { getCanonicalCompanyOwnerId } from "../lib/company.js";
import { getAverageRecordedCost } from "../lib/inventoryCost.js";
import {
  commissionBahtForLine,
  MONTHLY_COMMISSION_FREE_UNITS,
  MONTHLY_COMMISSION_PER_UNIT_BAHT,
  yearlyBonusProgress,
} from "../lib/salesCommission.js";
import { deleteUploadedFileFromR2 } from "../lib/r2Cleanup.js";
import { getDeliveryRangeFromKm } from "../lib/deliveryZones.js";
import {
  expandLogicalSaleIds,
  saleGroupToFrontendSale,
  saleRecordFrontendInclude,
  saleRecordsToFrontendSales,
} from "../lib/salesOrders.js";

const router = Router();

const saleLineSchema = z
  .object({
    deskItemId: z.string().uuid().optional(),
    type: z.string().optional().default(""),
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (!data.deskItemId && !String(data.type ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Each item needs a desk item id or product name",
      });
    }
  });

const frontendSaleSchema = z
  .object({
    date: z.string().min(1),
    type: z.string().optional().default(""),
    qty: z.number().int().positive().optional(),
    price: z.number().nonnegative().optional(),
    items: z.array(saleLineSchema).min(1).optional(),
    pay: z.enum(["paid", "pending", "deposit"]),
    discount: z.number().nonnegative().optional().default(0),
    manualDisc: z.number().nonnegative().optional().default(0),
    manualReason: z.string().optional().default(""),
    delivery: z.enum(["selfpickup", "delivery"]),
    km: z.number().nullable().optional(),
    zoneName: z.string().nullable().optional(),
    addr: z.string().optional().default(""),
    customerPhone: z.string().optional().default(""),
    deliveryAddress: z.string().optional().default(""),
    note: z.string().optional().default(""),
    wFee: z.number().nonnegative().optional().default(0),
    wType: z.enum(["po", "ice"]),
    promoId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasItems = Array.isArray(data.items) && data.items.length > 0;

    if (!hasItems) {
      if (!String(data.type ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["type"],
          message: "Product type is required",
        });
      }
      if (!Number.isInteger(data.qty) || Number(data.qty) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["qty"],
          message: "Quantity is required",
        });
      }
      if (data.price == null || Number(data.price) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Price is required",
        });
      }
    }

    if (Number(data.manualDisc || 0) > 0 && !String(data.manualReason ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualReason"],
        message: "Manual discount reason is required",
      });
    }

    if (data.delivery !== "delivery") {
      return;
    }

    if (data.km == null || data.km <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["km"],
        message: "Distance (km) is required for delivery and must be greater than 0",
      });
    }

    if (!String(data.addr ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addr"],
        message: "Customer name is required for delivery",
      });
    }

    if (!String(data.deliveryAddress ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveryAddress"],
        message: "Delivery address is required for delivery",
      });
    }

    if (!normalizeCustomerPhoneThai10(data.customerPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerPhone"],
        message: "Phone must be 10 digits starting with 0",
      });
    }
  });

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

const uploadPaymentSlipSchema = z.object({
  fileUrl: z.string().url(),
});

const createBatchPaymentSchema = z.object({
  saleIds: z.array(z.string().uuid()).min(2),
  fileUrl: z.string().url(),
  transferAmount: z.number().int().positive().optional(),
  note: z.string().optional().default(""),
});

const updateSaleStatusSchema = z.object({
  status: z.enum(["paid", "pending", "deposit"]),
});

/** OWNER sees all sales; SALES only their own rows (createdByUserId). */
function assertSalesStaffOwnsRecordOrOwner(req, sale, res) {
  if (req.role === UserRole.OWNER) {
    return true;
  }
  if (sale.createdByUserId !== req.user.id) {
    res.status(403).json({ error: "You can only access your own sales records" });
    return false;
  }
  return true;
}

function normalizedSaleAmountForBatch(sale) {
  const isLegacySelfPickupIceFee =
    sale?.deliveryType === "selfpickup" &&
    sale?.workerFeeType === "ice" &&
    Number(sale?.workerFee || 0) > 0;
  const deduction = isLegacySelfPickupIceFee ? Number(sale.workerFee || 0) : 0;
  return Math.max(0, Number(sale.amount || 0) - deduction);
}

function payloadLineItems(payload) {
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    return payload.items.map((item) => ({
      deskItemId: item.deskItemId || null,
      type: String(item.type ?? "").trim(),
      qty: Number(item.qty || 1),
      price: Number(item.price || 0),
    }));
  }

  return [
    {
      deskItemId: null,
      type: String(payload.type ?? "").trim(),
      qty: Number(payload.qty || 1),
      price: Number(payload.price || 0),
    },
  ];
}

function allocateIntegerTotal(total, weights) {
  const safeTotal = Math.max(0, Number(total || 0));
  if (weights.length === 0) {
    return [];
  }

  const safeWeights = weights.map((weight) => Math.max(0, Number(weight || 0)));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) {
    const evenShare = Math.floor(safeTotal / safeWeights.length);
    const remainder = safeTotal - evenShare * safeWeights.length;
    return safeWeights.map((_, index) => evenShare + (index === safeWeights.length - 1 ? remainder : 0));
  }

  let allocated = 0;
  return safeWeights.map((weight, index) => {
    if (index === safeWeights.length - 1) {
      return safeTotal - allocated;
    }
    const share = Math.floor((safeTotal * weight) / weightTotal);
    allocated += share;
    return share;
  });
}

async function resolveDeskItemForLine(tx, line) {
  if (line.deskItemId) {
    return tx.deskItem.findUnique({
      where: { id: line.deskItemId },
    });
  }

  return tx.deskItem.findFirst({
    where: {
      name: line.type,
    },
  });
}

function buildLineOrderNumber(orderNumber, lineNumber) {
  return `${orderNumber}-L${String(lineNumber).padStart(2, "0")}`;
}

async function getNextLogicalOrderSequence(tx, monthStart, monthEnd) {
  const [legacyCount, salesOrderCount] = await Promise.all([
    tx.saleRecord.count({
      where: {
        saleDate: {
          gte: monthStart,
          lt: monthEnd,
        },
        salesOrderId: null,
      },
    }),
    tx.salesOrder.count({
      where: {
        saleDate: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    }),
  ]);

  return legacyCount + salesOrderCount + 1;
}

async function loadLogicalSaleGroup(tx, id) {
  const sale = await tx.saleRecord.findUnique({
    where: { id },
    include: saleRecordFrontendInclude,
  });

  if (!sale) {
    return null;
  }

  const rows = sale.salesOrderId
    ? await tx.saleRecord.findMany({
        where: { salesOrderId: sale.salesOrderId },
        include: saleRecordFrontendInclude,
        orderBy: { createdAt: "asc" },
      })
    : [sale];

  return {
    representative: sale,
    rows,
    salesOrderId: sale.salesOrderId || null,
  };
}

function logicalSaleGroupToFrontend(group, includeCost) {
  return saleGroupToFrontendSale(
    {
      salesOrder: group.rows[0]?.salesOrder || null,
      rows: group.rows,
    },
    { includeCost }
  );
}

// GET /api/sales — OWNER: all sales in month; SALES: only records they created
router.get(
  "/",
  authenticate,
  requireSales,
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const { month, year } = req.query;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      
      const saleRecords = await prisma.saleRecord.findMany({
        where: {
          saleDate: {
            gte: start,
            lt: end,
          },
          ...(req.role === UserRole.SALES ? { createdByUserId: req.user.id } : {}),
        },
        include: saleRecordFrontendInclude,
        orderBy: { createdAt: "desc" },
      });
      
      const includeCost = req.role === UserRole.OWNER;
      const items = saleRecordsToFrontendSales(saleRecords, { includeCost });
      
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/sales/commission-insights — SALES only: monthly/yearly unit counts & encouragement copy
router.get("/commission-insights", authenticate, requireSales, async (req, res, next) => {
  try {
    if (req.role !== UserRole.SALES) {
      res.json({ applies: false, role: req.role });
      return;
    }

    const userId = req.user.id;
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 1));
    const yearStart = new Date(Date.UTC(y, 0, 1));
    const yearEnd = new Date(Date.UTC(y + 1, 0, 1));

    const [monthAgg, yearAgg, monthlyCommAgg] = await Promise.all([
      prisma.saleRecord.aggregate({
        where: { createdByUserId: userId, saleDate: { gte: monthStart, lt: monthEnd } },
        _sum: { quantity: true },
      }),
      prisma.saleRecord.aggregate({
        where: { createdByUserId: userId, saleDate: { gte: yearStart, lt: yearEnd } },
        _sum: { quantity: true },
      }),
      prisma.saleRecordCommission.aggregate({
        where: {
          userId,
          saleRecord: { saleDate: { gte: monthStart, lt: monthEnd } },
        },
        _sum: { amount: true },
      }),
    ]);

    const monthlyUnitsSold = monthAgg._sum.quantity ?? 0;
    const yearlyUnitsSold = yearAgg._sum.quantity ?? 0;
    const monthlyCommissionBaht = monthlyCommAgg._sum.amount ?? 0;

    const { currentTier, nextTier, tablesUntilNext } = yearlyBonusProgress(yearlyUnitsSold);

    let tablesUntilMonthlyCommission = null;
    if (monthlyUnitsSold <= MONTHLY_COMMISSION_FREE_UNITS) {
      tablesUntilMonthlyCommission = MONTHLY_COMMISSION_FREE_UNITS + 1 - monthlyUnitsSold;
    }

    const encouragementLines = [];
    if (tablesUntilMonthlyCommission != null && tablesUntilMonthlyCommission > 0) {
      encouragementLines.push(
        `อีก ${tablesUntilMonthlyCommission} โต๊ะจะเริ่มได้คอมมิชชั่น ${MONTHLY_COMMISSION_PER_UNIT_BAHT} บาท/ตัว (เดือนนี้)`
      );
    } else {
      encouragementLines.push(
        `ขายแล้ว ${monthlyUnitsSold} โต๊ะเดือนนี้ · คอมมิชชั่นสะสม ${monthlyCommissionBaht.toLocaleString("th-TH")} บาท`
      );
    }
    if (nextTier) {
      encouragementLines.push(
        `อีก ${tablesUntilNext} โต๊ะถึงโบนัสปี ${nextTier.bonusBaht.toLocaleString("th-TH")} บาท (เป้า ${nextTier.units} โต๊ะ/ปี)`
      );
    } else {
      encouragementLines.push(`ยอดขายปีนี้ ${yearlyUnitsSold} โต๊ะ — ถึงระดับโบนัสปีสูงสุดในแผนแล้ว`);
    }

    res.json({
      applies: true,
      calendarMonth: m,
      calendarYear: y,
      monthlyUnitsSold,
      yearlyUnitsSold,
      monthlyCommissionBaht,
      tablesUntilMonthlyCommission,
      yearlyCurrentTier: currentTier,
      yearlyNextTier: nextTier,
      tablesUntilYearlyBonus: tablesUntilNext,
      encouragementLines,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales - Create a new sale
router.post(
  "/",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(frontendSaleSchema),
  async (req, res, next) => {
    try {
      const payload = req.body;
      if (payload.promoId) {
        const promotion = await prisma.promotion.findUnique({
          where: { id: payload.promoId },
        });

        if (!promotion) {
          return res.status(404).json({ error: "Promotion not found" });
        }
      }

      const companyOwnerId = await getCanonicalCompanyOwnerId(prisma);
      const linesInput = payloadLineItems(payload);
      const deliveryRange = payload.delivery === "delivery" && payload.km ? getDeliveryRangeFromKm(payload.km) : null;

      const saleDate = new Date(payload.date);
      const year = saleDate.getUTCFullYear();
      const month = saleDate.getUTCMonth() + 1;
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 1));
      const resolvedLines = [];
      for (const line of linesInput) {
        const deskItem = await resolveDeskItemForLine(prisma, line);
        if (!deskItem) {
          const productLabel = line.type || line.deskItemId || "unknown";
          const error = new Error(`Desk item "${productLabel}" not found. Please create it first in catalog.`);
          error.statusCode = 404;
          throw error;
        }
        resolvedLines.push({
          deskItem,
          qty: Number(line.qty || 1),
          price: Number(line.price || 0),
          baseAmount: Number(line.price || 0) * Number(line.qty || 1),
        });
      }

      const subtotal = resolvedLines.reduce((sum, line) => sum + line.baseAmount, 0);
      const promoShares = allocateIntegerTotal(payload.discount || 0, resolvedLines.map((line) => line.baseAmount));
      const manualShares = allocateIntegerTotal(payload.manualDisc || 0, resolvedLines.map((line) => line.baseAmount));
      const feeShares = allocateIntegerTotal(payload.wFee || 0, resolvedLines.map((line) => line.baseAmount));

      let priorUnits = 0;
      if (req.role === UserRole.SALES) {
        const priorAgg = await prisma.saleRecord.aggregate({
          where: {
            createdByUserId: req.user.id,
            saleDate: { gte: monthStart, lt: monthEnd },
          },
          _sum: { quantity: true },
        });
        priorUnits = priorAgg._sum.quantity ?? 0;
      }

      const sequenceNext = await getNextLogicalOrderSequence(prisma, monthStart, monthEnd);
      const publicOrderNumber = `SO-${year}${String(month).padStart(2, "0")}-${String(sequenceNext).padStart(4, "0")}`;

      const avgCostByDeskItemId = new Map();
      const uniqueDeskItemIds = [...new Set(resolvedLines.map((line) => line.deskItem.id))];
      for (const deskItemId of uniqueDeskItemIds) {
        const avgRec = await getAverageRecordedCost(prisma, deskItemId);
        avgCostByDeskItemId.set(deskItemId, avgRec?.avgUnitCost ?? 0);
      }

      const sourceLots = await prisma.inventoryLot.findMany({
        where: {
          deskItemId: { in: uniqueDeskItemIds },
          remainingQty: { gt: 0 },
        },
        orderBy: [{ deskItemId: "asc" }, { createdAt: "asc" }],
      });

      const sourceLotsByDeskItemId = new Map();
      for (const lot of sourceLots) {
        const rows = sourceLotsByDeskItemId.get(lot.deskItemId) || [];
        rows.push({
          id: lot.id,
          remainingQty: lot.remainingQty,
        });
        sourceLotsByDeskItemId.set(lot.deskItemId, rows);
      }

      const savedRows = await prisma.$transaction(async (tx) => {

        const salesOrder = await tx.salesOrder.create({
          data: {
            ownerId: companyOwnerId,
            saleDate,
            orderNumber: publicOrderNumber,
            status: payload.pay,
            appliedPromotion: payload.promoId || null,
            promoDiscountTotal: payload.discount || 0,
            manualDiscount: payload.manualDisc || 0,
            manualDiscountReason: payload.manualReason || null,
            subtotal,
            grandTotal: Math.max(0, subtotal - Number(payload.discount || 0) - Number(payload.manualDisc || 0) + Number(payload.wFee || 0)),
            deliveryType: payload.delivery,
            deliveryRange,
            workerFee: payload.wFee || 0,
            workerFeeType: payload.wType || null,
            customerName: payload.addr || null,
            customerPhone: normalizeCustomerPhoneThai10(payload.customerPhone),
            deliveryAddress: String(payload.deliveryAddress ?? "").trim() || null,
            remarks: payload.note || null,
            createdByUserId: req.user.id,
            paidAt: payload.pay === "paid" ? new Date() : null,
          },
        });

        const createdRows = [];
        for (let index = 0; index < resolvedLines.length; index += 1) {
          const line = resolvedLines[index];
          const promoDiscount = promoShares[index] || 0;
          const manualDiscount = manualShares[index] || 0;
          const workerFee = feeShares[index] || 0;
          const lineSubtotal = line.baseAmount;
          const lineAmount = Math.max(0, lineSubtotal - promoDiscount - manualDiscount + workerFee);
          const avgUnitCostSnapshot = avgCostByDeskItemId.get(line.deskItem.id) ?? 0;
          const cogsTotal = avgUnitCostSnapshot * line.qty;
          const grossProfit = lineAmount - workerFee - cogsTotal;
          const lineNumber = index + 1;

          await tx.salesOrderLine.create({
            data: {
              salesOrderId: salesOrder.id,
              lineNumber,
              deskItemId: line.deskItem.id,
              quantity: line.qty,
              unitPrice: line.price,
              promoDiscount,
              manualDiscount,
              amount: lineAmount,
              avgUnitCostSnapshot,
              cogsTotal,
              grossProfit,
            },
          });

          const created = await tx.saleRecord.create({
            data: {
              ownerId: companyOwnerId,
              saleDate,
              orderNumber: buildLineOrderNumber(publicOrderNumber, lineNumber),
              deskType: line.deskItem.id,
              quantity: line.qty,
              unitPrice: line.price,
              promoDiscount,
              manualDiscount,
              manualDiscountReason: payload.manualReason || null,
              status: payload.pay,
              appliedPromotion: payload.promoId || null,
              amount: lineAmount,
              avgUnitCostSnapshot,
              cogsTotal,
              grossProfit,
              deliveryType: payload.delivery,
              deliveryRange,
              workerFee,
              workerFeeType: payload.wType || null,
              customerName: payload.addr || null,
              customerPhone: normalizeCustomerPhoneThai10(payload.customerPhone),
              deliveryAddress: String(payload.deliveryAddress ?? "").trim() || null,
              remarks: payload.note || null,
              paidAt: payload.pay === "paid" ? new Date() : null,
              createdByUserId: req.user.id,
              salesOrderId: salesOrder.id,
            },
            include: saleRecordFrontendInclude,
          });

          let remainingToConsume = line.qty;
          const sourceLotsForDeskItem = sourceLotsByDeskItemId.get(line.deskItem.id) || [];

          for (const lot of sourceLotsForDeskItem) {
            if (remainingToConsume <= 0) break;
            const takeQty = Math.min(lot.remainingQty, remainingToConsume);
            if (takeQty <= 0) continue;

            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { remainingQty: lot.remainingQty - takeQty },
            });

            await tx.inventoryMovement.create({
              data: {
                deskItemId: line.deskItem.id,
                inventoryLotId: lot.id,
                direction: "OUT",
                qty: takeQty,
                note: `Sale Order ${publicOrderNumber} - ${line.deskItem.name}`,
                createdByUserId: req.user.id,
              },
            });

            lot.remainingQty -= takeQty;
            remainingToConsume -= takeQty;
          }

          if (remainingToConsume > 0) {
            await tx.inventoryMovement.create({
              data: {
                deskItemId: line.deskItem.id,
                inventoryLotId: null,
                direction: "OUT",
                qty: remainingToConsume,
                note: `Sale Order ${publicOrderNumber} - ${line.deskItem.name} (unallocated; insufficient stock)`,
                createdByUserId: req.user.id,
              },
            });
          }

          if (req.role === UserRole.SALES) {
            const commBaht = commissionBahtForLine(priorUnits, line.qty);
            if (commBaht > 0) {
              await tx.saleRecordCommission.create({
                data: {
                  saleRecordId: created.id,
                  userId: req.user.id,
                  amount: commBaht,
                  remarks: `คอมมิชชั่นเกิน ${MONTHLY_COMMISSION_FREE_UNITS} โต๊ะ/เดือน (${MONTHLY_COMMISSION_PER_UNIT_BAHT} บาท/ตัว)`,
                },
              });
            }
            priorUnits += line.qty;
          }

          createdRows.push(created);
        }

        return createdRows;
      }, {
        maxWait: 5000,
        timeout: 15000,
      });

      const includeCost = req.role === UserRole.OWNER;
      const item = saleGroupToFrontendSale(
        {
          salesOrder: savedRows[0]?.salesOrder || null,
          rows: savedRows,
        },
        { includeCost }
      );

      res.status(201).json(item);
    } catch (error) {
      if (error?.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
);

// POST /api/sales/batch-payment - Attach one slip to multiple orders
router.post(
  "/batch-payment",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(createBatchPaymentSchema),
  async (req, res, next) => {
    try {
      const { saleIds, fileUrl, transferAmount, note } = req.body;
      const { saleRecords: sales, missingIds, logicalCount } = await expandLogicalSaleIds(prisma, saleIds);
      const expandedSaleRecordIds = sales.map((sale) => sale.id);

      if (missingIds.length > 0) {
        return res.status(404).json({ error: "Some sales were not found" });
      }

      if (req.role === UserRole.SALES) {
        const forbidden = sales.some((s) => s.createdByUserId !== req.user.id);
        if (forbidden) {
          return res.status(403).json({ error: "You can only batch your own sales records" });
        }
      }

      const alreadyPaid = sales.find((s) => s.status === "paid");
      if (alreadyPaid) {
        return res.status(409).json({ error: `Order ${alreadyPaid.orderNumber} is already paid` });
      }

      const alreadyBatched = sales.find((s) => s.paymentBatchId);
      if (alreadyBatched) {
        return res.status(409).json({ error: `Order ${alreadyBatched.orderNumber} already belongs to a batch` });
      }

      const ownerId = sales[0]?.ownerId;
      const crossOwner = sales.some((s) => s.ownerId !== ownerId);
      if (crossOwner) {
        return res.status(400).json({ error: "Batch payment must contain sales from the same owner scope" });
      }

      const totalAmount = sales.reduce((sum, sale) => sum + normalizedSaleAmountForBatch(sale), 0);
      if (transferAmount != null && Number(transferAmount) !== totalAmount) {
        return res.status(400).json({
          error: `Transfer amount mismatch: expected ${totalAmount}, got ${transferAmount}`,
        });
      }

      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 1));
      const sequence = await prisma.paymentBatch.count({
        where: {
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      });
      const batchNumber = `PB-${year}${String(month).padStart(2, "0")}-${String(sequence + 1).padStart(4, "0")}`;

      const batch = await prisma.$transaction(async (tx) => {
        const createdBatch = await tx.paymentBatch.create({
          data: {
            batchNumber,
            totalAmount,
            transferAmount: transferAmount ?? null,
            paymentSlipImage: fileUrl,
            note: String(note || "").trim() || null,
            createdByUserId: req.user.id,
          },
        });

        await tx.saleRecord.updateMany({
          where: { id: { in: expandedSaleRecordIds } },
          data: {
            paymentBatchId: createdBatch.id,
            paymentSlipImage: fileUrl,
            slipViewedAt: null,
          },
        });

        return createdBatch;
      });

      res.status(201).json({
        batch: {
          id: batch.id,
          batchNumber: batch.batchNumber,
          totalAmount: batch.totalAmount,
          transferAmount: batch.transferAmount,
          paymentSlipImage: batch.paymentSlipImage,
          saleCount: logicalCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/sales/:id - Delete a sale
router.patch(
  "/:id/payment-slip",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(uploadPaymentSlipSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { fileUrl } = req.body;

      const group = await loadLogicalSaleGroup(prisma, id);

      if (!group) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, group.representative, res)) {
        return;
      }

      const previousSlipUrl = group.rows[0]?.salesOrder?.paymentSlipImage || group.representative.paymentSlipImage;
      if (previousSlipUrl && previousSlipUrl !== fileUrl) {
        await deleteUploadedFileFromR2(previousSlipUrl);
      }

      if (group.salesOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id: group.salesOrderId },
            data: {
              paymentSlipImage: fileUrl,
              slipViewedAt: null,
            },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: group.salesOrderId },
            data: {
              paymentSlipImage: fileUrl,
              slipViewedAt: null,
            },
          });
        });
      } else {
        await prisma.saleRecord.update({
          where: { id },
          data: {
            paymentSlipImage: fileUrl,
            slipViewedAt: null,
          },
        });
      }

      const updatedGroup = await loadLogicalSaleGroup(prisma, id);

      const includeCost = req.role === UserRole.OWNER;
      res.json(logicalSaleGroupToFrontend(updatedGroup, includeCost));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/payment-slip",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const group = await loadLogicalSaleGroup(prisma, id);

      if (!group) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, group.representative, res)) {
        return;
      }

      const previousSlipUrl = group.rows[0]?.salesOrder?.paymentSlipImage || group.representative.paymentSlipImage;
      if (previousSlipUrl) {
        await deleteUploadedFileFromR2(previousSlipUrl);
      }

      if (group.salesOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id: group.salesOrderId },
            data: {
              paymentSlipImage: null,
              slipViewedAt: null,
            },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: group.salesOrderId },
            data: {
              paymentSlipImage: null,
              slipViewedAt: null,
            },
          });
        });
      } else {
        await prisma.saleRecord.update({
          where: { id },
          data: {
            paymentSlipImage: null,
            slipViewedAt: null,
          },
        });
      }

      const updatedGroup = await loadLogicalSaleGroup(prisma, id);

      const includeCost = req.role === UserRole.OWNER;
      res.json(logicalSaleGroupToFrontend(updatedGroup, includeCost));
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/slip-viewed",
  authenticate,
  requireOwner,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const group = await loadLogicalSaleGroup(prisma, id);

      if (!group) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const currentSlip = group.rows[0]?.salesOrder?.paymentSlipImage || group.representative.paymentSlipImage;
      if (!currentSlip) {
        return res.status(400).json({ error: "Cannot mark slip as viewed when no payment slip exists" });
      }

      const viewedAt = new Date();
      if (group.salesOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id: group.salesOrderId },
            data: {
              slipViewedAt: viewedAt,
            },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: group.salesOrderId },
            data: {
              slipViewedAt: viewedAt,
            },
          });
        });
      } else {
        await prisma.saleRecord.update({
          where: { id },
          data: {
            slipViewedAt: viewedAt,
          },
        });
      }

      const updatedGroup = await loadLogicalSaleGroup(prisma, id);
      res.json(logicalSaleGroupToFrontend(updatedGroup, true));
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/status",
  authenticate,
  requireOwner,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(updateSaleStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const group = await loadLogicalSaleGroup(prisma, id);

      if (!group) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const currentSlip = group.rows[0]?.salesOrder?.paymentSlipImage || group.representative.paymentSlipImage;
      const currentViewedAt = group.rows[0]?.salesOrder?.slipViewedAt || group.representative.slipViewedAt;
      if (status === "paid" && !currentSlip) {
        return res.status(400).json({ error: "Payment slip image is required before marking as paid" });
      }
      if (status === "paid" && !currentViewedAt) {
        return res.status(400).json({ error: "Please review the payment slip before confirming payment" });
      }

      const paidAt = status === "paid" ? new Date() : null;
      if (group.salesOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id: group.salesOrderId },
            data: {
              status,
              paidAt,
            },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: group.salesOrderId },
            data: {
              status,
              paidAt,
            },
          });
        });
      } else {
        await prisma.saleRecord.update({
          where: { id },
          data: {
            status,
            paidAt,
          },
        });
      }

      const updatedGroup = await loadLogicalSaleGroup(prisma, id);
      res.json(logicalSaleGroupToFrontend(updatedGroup, true));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  requireSales,
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const group = await loadLogicalSaleGroup(prisma, id);

      if (!group) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, group.representative, res)) {
        return;
      }

      const currentSlip = group.rows[0]?.salesOrder?.paymentSlipImage || group.representative.paymentSlipImage;
      if (currentSlip) {
        await deleteUploadedFileFromR2(currentSlip);
      }

      if (group.salesOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.saleRecordCommission.deleteMany({
            where: {
              saleRecordId: {
                in: group.rows.map((row) => row.id),
              },
            },
          });
          await tx.saleRecord.deleteMany({
            where: { salesOrderId: group.salesOrderId },
          });
          await tx.salesOrderLine.deleteMany({
            where: { salesOrderId: group.salesOrderId },
          });
          await tx.salesOrder.delete({
            where: { id: group.salesOrderId },
          });
        });
      } else {
        await prisma.saleRecord.delete({
          where: { id: group.representative.id },
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
