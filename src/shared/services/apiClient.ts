import { API as API_ROOT } from "@/config/env";
import {
  forceReauthentication,
  isUnauthorizedResponse,
} from "@/shared/services/sessionExpiry";
import { tokenStorage } from "@/shared/services/tokenStorage";

export const API = API_ROOT;

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Bearer only — for multipart uploads (do not set Content-Type). */
export async function authTokenHeader(): Promise<Record<string, string>> {
  const token = await tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * fetch wrapper that forces re-login on 401 (expired/missing server session)
 * instead of leaving the staff app showing "Staff sign-in required" banners.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (isUnauthorizedResponse(response)) {
    const body = (await response
      .clone()
      .json()
      .catch(() => ({}))) as { message?: string; Message?: string };
    await forceReauthentication(
      body.message ?? body.Message ?? "Staff sign-in required.",
    );
  }
  return response;
}
