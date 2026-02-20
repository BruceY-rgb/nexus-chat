// =====================================================
// Rate Limiter
// Prevent malicious email spamming attacks
// =====================================================

// In-memory storage (Redis recommended for production)
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

class MemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  /**
   * Check if rate limit is exceeded
   * @param key Limit key (e.g., email address or IP)
   * @param maxRequests Maximum number of requests
   * @param windowMs Time window (milliseconds)
   */
  check(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // First request
    if (!entry) {
      const newEntry: RateLimitEntry = {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      };
      this.store.set(key, newEntry);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    // Check if time window has expired
    if (now - entry.firstRequest >= windowMs) {
      // Reset window
      const newEntry: RateLimitEntry = {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      };
      this.store.set(key, newEntry);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    // Update request count
    entry.count++;
    entry.lastRequest = now;

    const allowed = entry.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTime = entry.firstRequest + windowMs;

    return {
      allowed,
      remaining,
      resetTime,
    };
  }

  /**
   * Get current limit status (without modification)
   */
  getStatus(key: string, windowMs: number): { count: number; remaining: number; resetTime: number } | null {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if time window has expired
    if (now - entry.firstRequest >= windowMs) {
      return null;
    }

    return {
      count: entry.count,
      remaining: Math.max(0, 5 - entry.count),
      resetTime: entry.firstRequest + windowMs,
    };
  }

  /**
   * Clean up expired entries (optional)
   */
  cleanup(maxAge: number = 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.lastRequest >= maxAge) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const emailRateLimiter = new MemoryRateLimiter();

/**
 * Email sending rate limit configuration
 */
export const EMAIL_RATE_LIMIT = {
  // Maximum 5 requests per email per hour
  MAX_REQUESTS_PER_EMAIL: 5,
  WINDOW_MS: 60 * 60 * 1000, // 1 hour

  // Maximum 10 requests per IP per hour (prevent IP-based email spamming)
  MAX_REQUESTS_PER_IP: 10,
};

/**
 * Check email rate limit
 */
export function checkEmailRateLimit(email: string): { allowed: boolean; remaining: number; resetTime: number } {
  return emailRateLimiter.check(
    `email:${email.toLowerCase()}`,
    EMAIL_RATE_LIMIT.MAX_REQUESTS_PER_EMAIL,
    EMAIL_RATE_LIMIT.WINDOW_MS
  );
}

/**
 * Check IP rate limit
 */
export function checkIPRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  return emailRateLimiter.check(
    `ip:${ip}`,
    EMAIL_RATE_LIMIT.MAX_REQUESTS_PER_IP,
    EMAIL_RATE_LIMIT.WINDOW_MS
  );
}

/**
 * Get email send status
 */
export function getEmailSendStatus(email: string): { count: number; remaining: number; resetTime: number } | null {
  const status = emailRateLimiter.getStatus(`email:${email.toLowerCase()}`, EMAIL_RATE_LIMIT.WINDOW_MS);
  if (status) {
    return {
      count: status.count,
      remaining: Math.max(0, EMAIL_RATE_LIMIT.MAX_REQUESTS_PER_EMAIL - status.count),
      resetTime: status.resetTime,
    };
  }
  return null;
}
