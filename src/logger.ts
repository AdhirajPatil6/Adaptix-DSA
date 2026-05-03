/**
 * Centralized Debug Logger for Adaptix
 * 
 * Provides structured logging that can be toggled on/off.
 * All debug output goes through this module for consistency.
 */

/** Set to true to enable debug output in the Extension Host console */
const DEBUG = false;

/**
 * Log a debug message with a labeled context.
 * Only outputs when DEBUG is true.
 * 
 * @param label - Category label (e.g., "Analyzer", "Decision", "Refactor")
 * @param message - Human-readable message
 * @param data - Optional structured data to log
 */
export function logDebug(label: string, message: string, data?: unknown): void {
    if (!DEBUG) { return; }
    if (data !== undefined) {
        console.log(`[Adaptix:${label}] ${message}`, JSON.stringify(data, null, 2));
    } else {
        console.log(`[Adaptix:${label}] ${message}`);
    }
}

/**
 * Log a warning that is always visible (not gated by DEBUG flag).
 */
export function logWarn(label: string, message: string, data?: unknown): void {
    if (data !== undefined) {
        console.warn(`[Adaptix:${label}] ${message}`, JSON.stringify(data, null, 2));
    } else {
        console.warn(`[Adaptix:${label}] ${message}`);
    }
}
