import { API, authHeaders } from "@/shared/services/apiClient";
import type { StaffLoginSession } from "@/features/authentication/models/auth.types";

export async function loginStaff(
  username: string,
  password: string,
): Promise<StaffLoginSession> {
  const response = await fetch(`${API}/auth/staff/login`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(body.message ?? body.Message ?? "Invalid username or password.");
  }

  const body = (await response.json()) as {
    token?: string;
    Token?: string;
    userId?: string;
    UserId?: string;
    username?: string;
    Username?: string;
    role?: string;
    Role?: string;
    societyIds?: string[];
    SocietyIds?: string[];
    primarySocietyId?: string | null;
    PrimarySocietyId?: string | null;
  };

  const token = body.token ?? body.Token;
  const userId = body.userId ?? body.UserId;
  if (!token || !userId) {
    throw new Error("The sign-in response is incomplete. Please try again.");
  }

  const rawSocietyIds = body.societyIds ?? body.SocietyIds ?? [];
  const societyIds = rawSocietyIds.filter(
    (id) => typeof id === "string" && id && id !== "00000000-0000-0000-0000-000000000000",
  );
  const rawPrimary = body.primarySocietyId ?? body.PrimarySocietyId ?? null;
  const primary =
    rawPrimary && rawPrimary !== "00000000-0000-0000-0000-000000000000"
      ? rawPrimary
      : societyIds.length > 0
        ? societyIds[0]
        : null;

  return {
    token,
    userId,
    username: body.username ?? body.Username ?? username,
    role: body.role ?? body.Role ?? "Staff",
    societyIds,
    primarySocietyId: primary,
  };
}
