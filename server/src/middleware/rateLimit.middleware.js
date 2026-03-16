const bypassRateLimit = (_req, _res, next) => next();

export const generalRateLimiter = bypassRateLimit;
export const authRateLimiter = bypassRateLimit;
export const writeRateLimiter = bypassRateLimit;
export const userRateLimiter = bypassRateLimit;
