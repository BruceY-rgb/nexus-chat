// =====================================================
// 频率限制器
// 防止恶意刷邮件攻击
// =====================================================

// 内存存储（生产环境建议使用 Redis）
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

class MemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  /**
   * 检查是否超过频率限制
   * @param key 限制键（如邮箱地址或IP）
   * @param maxRequests 最大请求数
   * @param windowMs 时间窗口（毫秒）
   */
  check(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // 首次请求
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

    // 检查时间窗口是否过期
    if (now - entry.firstRequest >= windowMs) {
      // 重置窗口
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

    // 更新请求计数
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
   * 获取当前限制状态（不修改）
   */
  getStatus(key: string, windowMs: number): { count: number; remaining: number; resetTime: number } | null {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // 检查时间窗口是否过期
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
   * 清理过期条目（可选调用）
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

// 全局频率限制器实例
export const emailRateLimiter = new MemoryRateLimiter();

/**
 * 邮件发送频率限制配置
 */
export const EMAIL_RATE_LIMIT = {
  // 每个邮箱每小时最多 5 次
  MAX_REQUESTS_PER_EMAIL: 5,
  WINDOW_MS: 60 * 60 * 1000, // 1小时

  // 每个IP每小时最多 10 次（防止IP刷邮件）
  MAX_REQUESTS_PER_IP: 10,
};

/**
 * 检查邮箱频率限制
 */
export function checkEmailRateLimit(email: string): { allowed: boolean; remaining: number; resetTime: number } {
  return emailRateLimiter.check(
    `email:${email.toLowerCase()}`,
    EMAIL_RATE_LIMIT.MAX_REQUESTS_PER_EMAIL,
    EMAIL_RATE_LIMIT.WINDOW_MS
  );
}

/**
 * 检查IP频率限制
 */
export function checkIPRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  return emailRateLimiter.check(
    `ip:${ip}`,
    EMAIL_RATE_LIMIT.MAX_REQUESTS_PER_IP,
    EMAIL_RATE_LIMIT.WINDOW_MS
  );
}

/**
 * 获取邮箱发送状态
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
