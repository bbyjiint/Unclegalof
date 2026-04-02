import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/authorize.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

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
      select: {
        id: true,
        orderNumber: true,
        saleDate: true,
        amount: true,
        customerName: true,
        customerPhone: true,
        deliveryAddress: true,
        deskItem: { select: { name: true } },
      },
    });

    const orders = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      saleDate: r.saleDate.toISOString(),
      totalPrice: r.amount,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      deliveryAddress: r.deliveryAddress,
      productName: r.deskItem?.name ?? "",
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

      const sale = await prisma.saleRecord.findUnique({
        where: { id },
        select: { id: true, deliveryType: true, deliveryCompletedAt: true },
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
