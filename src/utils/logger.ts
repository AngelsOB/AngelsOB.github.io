/**
 * Development-only logging utility.
 * All log calls are no-ops in production builds.
 *
 * Usage:
 *   import { devLog, devWarn, devError } from '@utils/logger';
 *   devError('[storage]', 'Failed to save:', error);
 */

/* eslint-disable no-console */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Log to console only in development mode.
 * Silently does nothing in production.
 */
export function devLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

/**
 * Warn to console only in development mode.
 * Silently does nothing in production.
 */
export function devWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

/**
 * Log error to console only in development mode.
 * Silently does nothing in production.
 */
export function devError(...args: unknown[]): void {
  if (isDev) {
    console.error(...args);
  }
}
