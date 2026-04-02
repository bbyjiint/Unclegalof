import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOwner, requireSales } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { saleRecordToSale, salePayloadToSaleRecord } from "../lib/adapters.js";
import { getCanonicalCompanyOwnerId } from "../lib/company.js";
import { getAverageRecordedCost } from "../lib/inventoryCost.js";
import {
  commissionBahtForLine,
  MONTHLY_COMMISSION_FREE_UNITS,
  MONTHLY_COMMISSION_PER_UNIT_BAHT,
  yearlyBonusProgress,
} from "../lib/salesCommission.js";
import { deleteUploadedFileFromR2 } from "../lib/r2Cleanup.js";

const router = Router();

// Frontend sale schema - matches what frontend sends
const frontendSaleSchema = z
  .object({
    date: z.string().min(1),
    type: z.string().min(1), // Product type name (e.g., "โต๊ะลอฟ 70")
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
    pay: z.enum(["paid", "pending", "deposit"]),
    discount: z.number().nonnegative().optional().default(0),
    manualDisc: z.number().nonnegative().optional().default(0),
    manualReason: z.string().optional().default(""),
    delivery: z.enum(["selfpickup", "delivery"]),
    km: z.number().nullable().optional(),
    zoneName: z.string().nullable().optional(),
    addr: z.string().optional().default(""),
    deliveryAddress: z.string().optional().default(""),
    note: z.string().optional().default(""),
    wFee: z.number().nonnegative().optional().default(0),
    wType: z.enum(["po", "ice"]),
    promoId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
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
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      
      // Transform to frontend format
      const includeCost = req.role === UserRole.OWNER;
      const items = saleRecords.map((sale, index) => saleRecordToSale(sale, index, { includeCost }));
      
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
      
      // Find desk item by name (type) for this business
      const deskItem = await prisma.deskItem.findFirst({
        where: {
          name: payload.type,
        },
      });
      
      if (!deskItem) {
        return res.status(404).json({ error: `Desk item "${payload.type}" not found. Please create it first in catalog.` });
      }
      
      if (payload.promoId) {
        const promotion = await prisma.promotion.findUnique({
          where: { id: payload.promoId },
        });

        if (!promotion) {
          return res.status(404).json({ error: "Promotion not found" });
        }
      }

      const companyOwnerId = await getCanonicalCompanyOwnerId(prisma);
      const saleRecordData = salePayloadToSaleRecord(payload, deskItem.id, companyOwnerId);

      const avgRec = await getAverageRecordedCost(prisma, deskItem.id);
      const qty = payload.qty || 1;
      const avgUnitCostSnapshot = avgRec?.avgUnitCost ?? 0;
      const cogsTotal = avgUnitCostSnapshot * qty;
      const productNet = saleRecordData.amount - (saleRecordData.workerFee || 0);
      const grossProfit = productNet - cogsTotal;
      saleRecordData.avgUnitCostSnapshot = avgUnitCostSnapshot;
      saleRecordData.cogsTotal = cogsTotal;
      saleRecordData.grossProfit = grossProfit;

      // Audit: who keyed this sale in (never overwritten by later slip/status edits).
      saleRecordData.createdByUserId = req.user.id;

      const saleDate = new Date(payload.date);
      const year = saleDate.getUTCFullYear();
      const month = saleDate.getUTCMonth() + 1;
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 1));

      const includeBlock = {
        promotion: true,
        deskItem: true,
        deliveryFee: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      };

      const { saleRecord, sequence } = await prisma.$transaction(async (tx) => {
        let priorUnits = 0;
        if (req.role === UserRole.SALES) {
          const priorAgg = await tx.saleRecord.aggregate({
            where: {
              createdByUserId: req.user.id,
              saleDate: { gte: monthStart, lt: monthEnd },
            },
            _sum: { quantity: true },
          });
          priorUnits = priorAgg._sum.quantity ?? 0;
        }

        const sequenceNext = await tx.saleRecord.count({
          where: {
            saleDate: {
              gte: monthStart,
              lt: monthEnd,
            },
          },
        });

        saleRecordData.orderNumber = `SO-${year}${String(month).padStart(2, "0")}-${String(sequenceNext + 1).padStart(4, "0")}`;

        const created = await tx.saleRecord.create({
          data: saleRecordData,
          include: includeBlock,
        });

        if (req.role === UserRole.SALES) {
          const commBaht = commissionBahtForLine(priorUnits, qty);
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
        }

        return { saleRecord: created, sequence: sequenceNext };
      });

      const includeCost = req.role === UserRole.OWNER;
      const item = saleRecordToSale(saleRecord, sequence, { includeCost });

      res.status(201).json(item);
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

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, sale, res)) {
        return;
      }

      const previousSlipUrl = sale.paymentSlipImage;
      if (previousSlipUrl && previousSlipUrl !== fileUrl) {
        await deleteUploadedFileFromR2(previousSlipUrl);
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          paymentSlipImage: fileUrl,
          slipViewedAt: null,
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      const includeCost = req.role === UserRole.OWNER;
      res.json(saleRecordToSale(updatedSale, null, { includeCost }));
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

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, sale, res)) {
        return;
      }

      const previousSlipUrl = sale.paymentSlipImage;
      if (previousSlipUrl) {
        await deleteUploadedFileFromR2(previousSlipUrl);
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          paymentSlipImage: null,
          slipViewedAt: null,
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      const includeCost = req.role === UserRole.OWNER;
      res.json(saleRecordToSale(updatedSale, null, { includeCost }));
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

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!sale.paymentSlipImage) {
        return res.status(400).json({ error: "Cannot mark slip as viewed when no payment slip exists" });
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          slipViewedAt: new Date(),
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      res.json(saleRecordToSale(updatedSale, null, { includeCost: true }));
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

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (status === "paid" && !sale.paymentSlipImage) {
        return res.status(400).json({ error: "Payment slip image is required before marking as paid" });
      }
      if (status === "paid" && !sale.slipViewedAt) {
        return res.status(400).json({ error: "Please review the payment slip before confirming payment" });
      }

      const updatedSale = await prisma.saleRecord.update({
        where: { id },
        data: {
          status,
          paidAt: status === "paid" ? new Date() : null,
        },
        include: {
          promotion: true,
          deskItem: true,
          deliveryFee: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      res.json(saleRecordToSale(updatedSale, null, { includeCost: true }));
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
      
      const sale = await prisma.saleRecord.findUnique({
        where: { id },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (!assertSalesStaffOwnsRecordOrOwner(req, sale, res)) {
        return;
      }

      if (sale.paymentSlipImage) {
        await deleteUploadedFileFromR2(sale.paymentSlipImage);
      }

      await prisma.saleRecord.delete({
        where: { id: sale.id },
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
