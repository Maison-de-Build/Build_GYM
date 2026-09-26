/**
 * appleHealth.js — non-iOS stand-in for appleHealth.ios.js.
 *
 * Apple Health only exists on iPhone. Metro resolves this file on Android, so
 * the HealthKit library is never imported there. Same surface, inert values:
 * callers check isAvailable() and the Devices screen hides the Apple row.
 */
export const READ_TYPES = [];

export async function isAvailable() {
  return false;
}

export async function needsPermissionPrompt() {
  return false;
}

export async function requestPermission() {
  return false;
}

export async function readWindow() {
  throw new Error('Apple Health is only available on iPhone');
}
