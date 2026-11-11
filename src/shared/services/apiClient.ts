import { API as API_ROOT } from "@/config/env";
import { tokenStorage } from "@/shared/services/tokenStorage";

export const API = API_ROOT;

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
