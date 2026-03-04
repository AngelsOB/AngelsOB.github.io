'use client';

import { devError } from './logger';

export type StoredValue<T> = {
  version: number;
  value: T;
};

/**
 * Error types for storage operations
 * - 'not_found': Key doesn't exist in storage (normal case)
 * - 'parse_error': JSON.parse failed (data corruption)
 * - 'storage_unavailable': localStorage not accessible (private browsing, SecurityError)
 * - 'quota_exceeded': Storage quota exceeded
 */
export type StorageErrorType =
  | 'not_found'
  | 'parse_error'
  | 'storage_unavailable'
  | 'quota_exceeded';

/**
 * Result type for storage operations with explicit error handling
 */
export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StorageErrorType; rawData?: string; message?: string };

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load JSON from localStorage with explicit error handling.
 * Use this when you need to distinguish between different error types
 * (e.g., to show different UI for corrupted data vs private browsing).
 *
 * @param key - localStorage key
 * @returns StorageResult with either the value or error details
 */
export function loadJsonSafe<T>(key: string): StorageResult<T> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return { ok: false, error: 'not_found' };
    }

    try {
      const parsed = JSON.parse(raw) as StoredValue<T> | T;
      // Handle versioned storage format
      if (parsed && typeof parsed === 'object' && 'value' in (parsed as object)) {
        return { ok: true, value: (parsed as StoredValue<T>).value };
      }
      return { ok: true, value: parsed as T };
    } catch {
      // JSON.parse failed - data is corrupted
      return { ok: false, error: 'parse_error', rawData: raw };
    }
  } catch (e) {
    // Storage access failed
    if (e instanceof DOMException) {
      if (e.name === 'SecurityError' || e.name === 'QuotaExceededError') {
        return {
          ok: false,
          error: e.name === 'QuotaExceededError' ? 'quota_exceeded' : 'storage_unavailable',
          message: e.message,
        };
      }
    }
    return { ok: false, error: 'storage_unavailable', message: String(e) };
  }
}

/**
 * Load JSON from localStorage (legacy convenience function).
 * Returns defaultValue on any error. For explicit error handling, use loadJsonSafe().
 *
 * @param key - localStorage key
 * @param defaultValue - Value to return if key not found or on error
 * @returns The stored value or defaultValue
 */
export function loadJson<T>(key: string, defaultValue: T): T {
  const result = loadJsonSafe<T>(key);
  if (result.ok) {
    return result.value;
  }

  // Log meaningful errors (not 'not_found' which is normal)
  if (result.error === 'parse_error') {
    devError(
      `[storage] Corrupted data for key "${key}". Raw data length: ${result.rawData?.length ?? 0} bytes.`
    );
  } else if (result.error === 'storage_unavailable') {
    devError(`[storage] Storage unavailable for key "${key}": ${result.message}`);
  } else if (result.error === 'quota_exceeded') {
    devError(`[storage] Quota exceeded when reading key "${key}"`);
  }

  return defaultValue;
}

/**
 * Result type for save operations
 */
export type SaveResult =
  | { ok: true }
  | { ok: false; error: 'quota_exceeded' | 'storage_unavailable'; message?: string };

/**
 * Save JSON to localStorage with explicit error handling.
 * Use this when you need to handle storage failures (e.g., show toast on quota exceeded).
 *
 * @param key - localStorage key
 * @param value - Value to store
 * @param version - Storage format version (default: 1)
 * @returns SaveResult indicating success or error
 */
export function saveJsonSafe<T>(key: string, value: T, version = 1): SaveResult {
  const payload: StoredValue<T> = { version, value };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota_exceeded', message: e.message };
    }
    return { ok: false, error: 'storage_unavailable', message: String(e) };
  }
}

/**
 * Save JSON to localStorage (legacy convenience function).
 * Throws on storage errors. For explicit error handling, use saveJsonSafe().
 *
 * @param key - localStorage key
 * @param value - Value to store
 * @param version - Storage format version (default: 1)
 */
export function saveJson<T>(key: string, value: T, version = 1): void {
  const result = saveJsonSafe(key, value, version);
  if (!result.ok) {
    const errorMsg =
      result.error === 'quota_exceeded'
        ? `Storage quota exceeded when saving key "${key}"`
        : `Storage unavailable when saving key "${key}": ${result.message}`;
    devError(`[storage] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Delete a key from localStorage.
 *
 * @param key - localStorage key to remove
 * @returns true if successful, false if storage unavailable
 */
export function deleteJson(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    devError(`[storage] Failed to delete key "${key}": ${e}`);
    return false;
  }
}
