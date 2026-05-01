/**
 * Cache Service (In-Memory LRU)
 * 
 * NOTE: This is an in-memory cache intended for single-instance deployments.
 * It is structured modularly so it can be seamlessly replaced with a distributed
 * cache (like Redis) if the platform scales horizontally in the future.
 */
import { logger } from '../utils/logger.js';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

class CacheService {
  private cache: Map<string, CacheEntry>;
  private readonly MAX_SIZE = 5000; // Limit to prevent memory exhaustion
  private readonly DEFAULT_TTL = 300000; // 5 minutes

  constructor() {
    this.cache = new Map();
  }

  /**
   * Retrieves a value from the cache.
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      logger.info(`[CACHE MISS] ${key}`);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.info(`[CACHE MISS (EXPIRED)] ${key}`);
      return null;
    }

    logger.info(`[CACHE HIT] ${key}`);
    return entry.value;
  }

  /**
   * Sets a value in the cache with LRU eviction logic.
   */
  async set(key: string, value: any, ttlMs: number = this.DEFAULT_TTL): Promise<void> {
    if (this.cache.size >= this.MAX_SIZE) {
      // LRU Eviction: Map iterates in insertion order, so the first key is the oldest.
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Deletes a specific key.
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Invalidates all keys matching a specific prefix pattern.
   */
  async invalidatePattern(prefix: string): Promise<void> {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      logger.info(`[CACHE INVALIDATED] ${deletedCount} keys matching '${prefix}'`);
    }
  }

  /**
   * Clears the entire cache.
   */
  async flushAll(): Promise<void> {
    this.cache.clear();
  }
}

// Export a singleton instance
export const cacheService = new CacheService();
