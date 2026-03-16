import rateLimit from "express-rate-limit";

/**
 * General API rate limiter - prevents DDoS and abuse
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use IP address from request (respects proxies)
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 login attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many authentication attempts",
      message: "Please wait before trying again.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Moderate rate limiter for write operations (POST, PUT, DELETE)
 * 30 requests per 15 minutes per IP
 */
export const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 write requests per windowMs
  message: {
    error: "Too many write requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use authenticated user ID if available, otherwise IP
    return req.user?.id || req.ip || req.socket.remoteAddress || "unknown";
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many write requests",
      message: "Please slow down your requests.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Per-user rate limiter (for authenticated users)
 * 200 requests per 15 minutes per user
 */
export const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each user to 200 requests per windowMs
  message: {
    error: "Too many requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  skipFailedRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "You've made too many requests. Please try again later.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});
