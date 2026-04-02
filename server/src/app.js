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
import uploadsRoutes from "./routes/uploads.routes.js";
import { generalRateLimiter } from "./middleware/rateLimit.middleware.js";

function parseAllowedOrigins(value) {
  const configured = (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Keep sane defaults for local dev and the current production frontend.
  if (configured.length === 0) {
    return ["http://localhost:5173", "https://unclegalof-client.vercel.app"];
  }

  return configured;
}

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/+$/, "");
}

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(
    parseAllowedOrigins(process.env.CLIENT_ORIGIN).map((origin) => normalizeOrigin(origin))
  );
  const bodyLimit = process.env.MAX_BODY_SIZE || "12mb";

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  // Security: CORS
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
          return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    })
  );

  app.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  // Security: Body parser with size limit for regular JSON requests
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  // Security: General rate limiting (applied to all routes)
  app.use("/api", generalRateLimiter);

  // Health check (no auth required)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public routes (no auth required)
  app.use("/api/auth", authRoutes);

  // Protected routes (require authentication - will be added per route)
  app.use("/api/uploads", uploadsRoutes);
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
    const statusCode = Number(error?.statusCode || error?.status || 500);
    const safeMessage =
      statusCode >= 500 ? "Internal server error" : error?.message || "Request failed";

    res.status(statusCode).json({ error: safeMessage });
  });

  return app;
}

const app = createApp();
export default app;
