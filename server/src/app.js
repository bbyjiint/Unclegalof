import cors from "cors";
import express from "express";
import catalogRoutes from "./routes/catalog.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import pipelineRoutes from "./routes/pipeline.routes.js";
import promotionsRoutes from "./routes/promotions.routes.js";
import repairsRoutes from "./routes/repairs.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { generalRateLimiter } from "./middleware/rateLimit.middleware.js";

export function createApp() {
  const app = express();

  // Security: CORS
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      credentials: true, // Allow cookies/auth headers
    })
  );

  // Security: Body parser with size limit
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Security: General rate limiting (applied to all routes)
  app.use("/api", generalRateLimiter);

  // Health check (no auth required)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public routes (no auth required)
  app.use("/api/auth", authRoutes);

  // Protected routes (require authentication - will be added per route)
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/promotions", promotionsRoutes);
  app.use("/api/repairs", repairsRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/pipeline", pipelineRoutes);
  app.use("/api/sales", salesRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  // Error handler
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  return app;
}
