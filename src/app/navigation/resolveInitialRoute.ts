import type { RootStackParamList } from "@/app/navigation/types";
import {
  clearStaffSession,
  getResidentSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { API } from "@/shared/services/apiClient";
import { tokenStorage } from "@/shared/services/tokenStorage";

/**
 * Cold-start route from persisted session; Launch when signed out or when the
 * server session is already gone (Redis miss) even if local TTL still looks valid.
 */
export async function resolveInitialRoute(): Promise<
  keyof RootStackParamList
> {
  const token = await tokenStorage.getToken();
  if (!token) return "Launch";

  const staff = await getStaffSession();
  if (staff) {
    const alive = await probeStaffSession(token);
    if (!alive) {
      await Promise.all([clearStaffSession(), tokenStorage.removeToken()]);
      return "Launch";
    }
    return "StaffApp";
  }

  const resident = await getResidentSession();
  if (resident) return "ResidentApp";

  await tokenStorage.removeToken();
  return "Launch";
}

/** Lightweight authenticated GET — 401 means Redis/server session is gone. */
async function probeStaffSession(token: string): Promise<boolean> {
  try {
    // Raw fetch: avoid navigation side-effects before the container is mounted.
    const response = await fetch(`${API}/auth/staff/session`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401) return false;
    return true;
  } catch {
    // Network blip — keep local session; screens will retry.
    return true;
  }
}
