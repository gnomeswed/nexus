/**
 * Security Middleware for Nexus OS
 * Handles Rate Limiting and PIN Authentication
 */

const rateLimitMap = new Map();

const security = {
  // Simple Rate Limiter
  rateLimiter: (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // 100 requests per minute

    let record = rateLimitMap.get(ip);
    if (!record) {
      record = { count: 1, startTime: now };
      rateLimitMap.set(ip, record);
    } else {
      if (now - record.startTime > windowMs) {
        record.count = 1;
        record.startTime = now;
      } else {
        record.count++;
      }
    }

    if (record.count > maxRequests) {
      console.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
    next();
  },

  // PIN Authentication
  pinAuth: (req, res, next) => {
    const systemPin = process.env.AUTH_PIN;
    if (!systemPin) return next(); // Not configured, skip

    // Exempt some routes if needed (e.g., /api/health)
    if (req.path === '/api/health') return next();

    const userPin = req.headers['x-nexus-pin'];
    if (userPin === systemPin) {
      return next();
    }

    res.status(401).json({ error: 'Unauthorized: Valid PIN required' });
  }
};

module.exports = security;
