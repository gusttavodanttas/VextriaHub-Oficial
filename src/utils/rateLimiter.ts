
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: any) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  private getKey(identifier: string): string {
    return this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
  }

  public isRateLimited(identifier: string): boolean {
    const key = this.getKey(identifier);
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return false;
    }

    if (entry.count >= this.config.maxRequests) {
      return true;
    }

    // Increment count
    entry.count++;
    return false;
  }

  public getRemainingRequests(identifier: string): number {
    const key = this.getKey(identifier);
    const entry = this.store.get(key);
    
    if (!entry || Date.now() > entry.resetTime) {
      return this.config.maxRequests;
    }
    
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  public getResetTime(identifier: string): number {
    const key = this.getKey(identifier);
    const entry = this.store.get(key);
    
    return entry ? entry.resetTime : Date.now();
  }
}

// Create rate limiters for different actions
export const authRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

export const inviteRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// Hook to use rate limiting
export const useRateLimit = (limiter: RateLimiter, identifier: string) => {
  const checkLimit = (): { allowed: boolean; remaining: number; resetTime: number } => {
    const allowed = !limiter.isRateLimited(identifier);
    const remaining = limiter.getRemainingRequests(identifier);
    const resetTime = limiter.getResetTime(identifier);
    
    return { allowed, remaining, resetTime };
  };

  return { checkLimit };
};
