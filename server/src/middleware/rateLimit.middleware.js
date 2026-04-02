import rateLimit from "express-rate-limit";

function buildLimiter({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
  });
}

export const generalRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests. Please try again later.",
});

export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

export const writeRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many write requests. Please slow down and try again.",
});

export const userRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many account requests. Please try again later.",
});
