import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";
import { saleRecordFrontendInclude, saleRecordsToFrontendSales } from "../lib/salesOrders.js";

const router = Router();

const paramsIdSchema = z.object({
  id: z.string().uuid(),
});

const queryMonthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const completeBodySchema = z.object({
  proofImageUrl: z.string().url(),
});

function toIso(value) {
  return value?.toISOString?.() ?? null;
}

function orderLineToDeliveryItem(line) {
  return {
    id: line.id,
    deskItemId: line.deskItemId,
    type: line.deskItem?.name || "",
    qty: line.quantity ?? 1,
    price: line.unitPrice ?? 0,
    grandTotal: line.amount ?? 0,
    deskPhotos: Array.isArray(line.deskPhotos) ? line.deskPhotos : [],
  };
}

function saleRecordToDeliveryItem(row) {
  return {
    id: row.id,
    deskItemId: row.deskType,
    type: row.deskItem?.name || "",
    qty: row.quantity ?? 1,
    price: row.unitPrice ?? 0,
    grandTotal: row.amount ?? 0,
    deskPhotos: Array.isArray(row.deskPhotos) ? row.deskPhotos : [],
  };
}

/**
 * GET /api/deliveries — OWNER + REPAIRS: pending home deliveries (not yet marked complete).
 */
router.get("/", authenticate, requireRole(UserRole.OWNER, UserRole.REPAIRS), async (_req, res, next) => {
  try {
    const rows = await prisma.saleRecord.findMany({
      where: {
        deliveryType: "delivery",
        deliveryCompletedAt: null,
      },
      orderBy: { saleDate: "desc" },
      take: 400,
      include: saleRecordFrontendInclude,
    });

    const orders = saleRecordsToFrontendSales(rows).map((sale) => ({
      id: sale.id,
      orderNumber: sale.orderNumber,
      saleDate: sale.date ? `${sale.date}T00:00:00.000Z` : new Date().toISOString(),
      totalPrice: sale.grandTotal,
      customerName: sale.customerName ?? null,
      customerPhone: sale.customerPhone ?? null,
      deliveryAddress: sale.deliveryAddress ?? null,
      productName: sale.type,
      deskPhotos: Array.isArray(sale.deskPhotos) ? sale.deskPhotos : [],
      items: Array.isArray(sale.items) ? sale.items : [],
    }));

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/history — OWNER: completed home delivery history for selected delivery month.
 */
router.get(
  "/history",
  authenticate,
  requireRole(UserRole.OWNER),
  validate(queryMonthYearSchema, "query"),
  async (req, res, next) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const [orders, legacyRows] = await Promise.all([
        prisma.salesOrder.findMany({
          where: {
            deliveryType: "delivery",
            deliveryCompletedAt: { gte: start, lt: end },
          },
          orderBy: { deliveryCompletedAt: "desc" },
          take: 400,
          include: {
            lines: {
              include: { deskItem: true },
              orderBy: { lineNumber: "asc" },
            },
          },
        }),
        prisma.saleRecord.findMany({
          where: {
            salesOrderId: null,
            deliveryType: "delivery",
            deliveryCompletedAt: { gte: start, lt: end },
          },
          orderBy: { deliveryCompletedAt: "desc" },
          take: 400,
          include: { deskItem: true },
        }),
      ]);

      const modern = orders.map((order) => {
        const items = order.lines.map(orderLineToDeliveryItem);
        const productName = Array.from(new Set(items.map((item) => item.type).filter(Boolean))).join(", ");
        const deskPhotos = Array.from(new Set([
          ...(Array.isArray(order.deskPhotos) ? order.deskPhotos : []),
          ...items.flatMap((item) => item.deskPhotos || []),
        ]));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          saleDate: toIso(order.saleDate) ?? new Date().toISOString(),
          deliveryCompletedAt: toIso(order.deliveryCompletedAt),
          totalPrice: order.grandTotal,
          customerName: order.customerName ?? null,
          customerPhone: order.customerPhone ?? null,
          deliveryAddress: order.deliveryAddress ?? null,
          productName,
          deliveryProofImage: order.deliveryProofImage ?? null,
          deliveryAcknowledgedAt: toIso(order.deliveryAcknowledgedAt),
          deskPhotos,
          items,
        };
      });

      const legacy = legacyRows.map((row) => {
        const item = saleRecordToDeliveryItem(row);
        return {
          id: row.id,
          orderNumber: row.orderNumber,
          saleDate: toIso(row.saleDate) ?? new Date().toISOString(),
          deliveryCompletedAt: toIso(row.deliveryCompletedAt),
          totalPrice: row.amount,
          customerName: row.customerName ?? null,
          customerPhone: row.customerPhone ?? null,
          deliveryAddress: row.deliveryAddress ?? null,
          productName: item.type,
          deliveryProofImage: row.deliveryProofImage ?? null,
          deliveryAcknowledgedAt: toIso(row.deliveryAcknowledgedAt),
          deskPhotos: Array.isArray(row.deskPhotos) ? row.deskPhotos : [],
          items: [item],
        };
      });

      const rows = [...modern, ...legacy].sort(
        (a, b) => new Date(b.deliveryCompletedAt || 0).getTime() - new Date(a.deliveryCompletedAt || 0).getTime()
      );

      res.json({ orders: rows });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/deliveries/:id/complete — mark a delivery order as completed (driver done).
 */
router.patch(
  "/:id/complete",
  authenticate,
  requireRole(UserRole.OWNER, UserRole.REPAIRS),
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  validate(completeBodySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { proofImageUrl } = req.body;

      const order = await prisma.salesOrder.findUnique({
        where: { id },
        select: { id: true, deliveryType: true, deliveryCompletedAt: true },
      });

      if (order) {
        if (order.deliveryType !== "delivery") {
          return res.status(400).json({ error: "Not a delivery order" });
        }

        if (order.deliveryCompletedAt) {
          return res.status(409).json({ error: "Delivery already completed" });
        }

        const completedAt = new Date();
        const updated = await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id },
            data: { deliveryCompletedAt: completedAt, deliveryProofImage: proofImageUrl },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: id },
            data: { deliveryCompletedAt: completedAt, deliveryProofImage: proofImageUrl },
          });
          return completedAt;
        });

        res.json({
          ok: true,
          deliveryCompletedAt: updated.toISOString(),
        });
        return;
      }

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        select: { id: true, salesOrderId: true, deliveryType: true, deliveryCompletedAt: true },
      });

      if (!sale) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (sale.deliveryType !== "delivery") {
        return res.status(400).json({ error: "Not a delivery order" });
      }

      if (sale.deliveryCompletedAt) {
        return res.status(409).json({ error: "Delivery already completed" });
      }

      if (sale.salesOrderId) {
        const completedAt = new Date();
        const updated = await prisma.$transaction(async (tx) => {
          await tx.salesOrder.update({
            where: { id: sale.salesOrderId },
            data: { deliveryCompletedAt: completedAt, deliveryProofImage: proofImageUrl },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: sale.salesOrderId },
            data: { deliveryCompletedAt: completedAt, deliveryProofImage: proofImageUrl },
          });
          return completedAt;
        });

        res.json({
          ok: true,
          deliveryCompletedAt: updated.toISOString(),
        });
        return;
      }

      const updated = await prisma.saleRecord.update({
        where: { id },
        data: { deliveryCompletedAt: new Date(), deliveryProofImage: proofImageUrl },
        select: { deliveryCompletedAt: true },
      });

      res.json({
        ok: true,
        deliveryCompletedAt: updated.deliveryCompletedAt?.toISOString() ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
