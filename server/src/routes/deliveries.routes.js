import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/authorize.middleware.js";

const router = Router();

/**
 * GET /api/deliveries — OWNER + REPAIRS: home delivery orders (minimal fields for drivers).
 */
router.get("/", authenticate, requireRole(UserRole.OWNER, UserRole.REPAIRS), async (_req, res, next) => {
  try {
    const rows = await prisma.saleRecord.findMany({
      where: { deliveryType: "delivery" },
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

export default router;
