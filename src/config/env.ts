/**
 * Mobile API base URL.
 * Physical device cannot use localhost — use QA VM IP or your PC LAN IP.
 * Override with EXPO_PUBLIC_API_BASE_URL in a local .env file.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://34.47.185.139:5000";

export const API = `${API_BASE_URL}/api/v2`;
