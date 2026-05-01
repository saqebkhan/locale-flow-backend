/**
 * Structured Logger Utility
 *
 * Provides a central point for all backend logging.
 * Gated by environment to prevent log-bloat in production.
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Info logs are only visible in development mode.
   */
  info: (msg: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args);
    }
  },

  /**
   * Warnings are always visible.
   */
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args);
  },

  /**
   * Errors are always visible.
   */
  error: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args);
  },

  /**
   * Debug logs (same as info but explicitly for debugging).
   */
  debug: (msg: string, ...args: any[]) => {
    if (isDev) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`, ...args);
    }
  }
};
