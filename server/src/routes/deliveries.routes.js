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
 * PATCH /api/deliveries/:id/complete — mark a delivery order as completed (driver done).
 */
router.patch(
  "/:id/complete",
  authenticate,
  requireRole(UserRole.OWNER, UserRole.REPAIRS),
  writeRateLimiter,
  validate(paramsIdSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

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
            data: { deliveryCompletedAt: completedAt },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: id },
            data: { deliveryCompletedAt: completedAt },
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
            data: { deliveryCompletedAt: completedAt },
          });
          await tx.saleRecord.updateMany({
            where: { salesOrderId: sale.salesOrderId },
            data: { deliveryCompletedAt: completedAt },
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
        data: { deliveryCompletedAt: new Date() },
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
