import { API } from "@/shared/services/apiClient";
import type {
  RegisteredResident,
  RegisterResidentRequest,
  ResidentLoginSession,
} from "@/features/authentication/models/auth.types";

/**
 * Self-registration via existing POST /residents/addresident.
 * Passes empty userId so the API creates the linked Resident-role user.
 */
export async function registerResident(
  request: RegisterResidentRequest,
): Promise<RegisteredResident> {
  const response = await fetch(`${API}/residents/addresident`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      societyId: request.societyId,
      // Empty GUID = self-registration; API creates the linked Resident user.
      userId: "00000000-0000-0000-0000-000000000000",
      fullname: request.fullName,
      phoneNo: request.phoneNumber,
      towerWing: request.towerWing,
      flatnumber: request.flatNumber,
      flatNumber: request.flatNumber,
      isMember: true,
      picUrl: null,
      isActive: true,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    if (response.status === 409) {
      throw new Error("An account with this mobile number already exists.");
    }
    throw new Error(
      body.message ?? body.Message ?? "We could not create your account. Please try again.",
    );
  }

  const body = (await response.json()) as { id?: string; Id?: string };
  return {
    id: String(body.id ?? body.Id ?? ""),
    userId: "",
    societyId: request.societyId,
    fullName: request.fullName,
    towerWing: request.towerWing,
    flatNumber: request.flatNumber,
    phoneNumber: request.phoneNumber,
    isActive: true,
  };
}

export async function requestResidentLoginOtp(
  phoneNumber: string,
): Promise<string | undefined> {
  const response = await fetch(`${API}/auth/resident/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    if (response.status === 404) {
      throw new Error("This mobile number is not registered. Please register first.");
    }
    if (response.status === 429) {
      throw new Error("Too many code requests. Wait a few minutes and try again.");
    }
    throw new Error(
      body.message ?? body.Message ?? "We could not send an SMS code. Please try again.",
    );
  }

  const body = (await response.json()) as { otp?: string; Otp?: string };
  return body.otp ?? body.Otp;
}

export async function verifyResidentLoginOtp(
  phoneNumber: string,
  otp: string,
): Promise<ResidentLoginSession> {
  // Do not send a leftover staff/admin Bearer — OTP verify is public.
  const response = await fetch(`${API}/auth/resident/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, otp }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    if (response.status === 410) {
      throw new Error("This code has expired. Request a new SMS code.");
    }
    throw new Error(
      body.message ?? body.Message ?? "That code is not correct. Please try again.",
    );
  }

  const body = (await response.json()) as Record<string, unknown>;
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" || typeof value === "boolean") return String(value);
    }
    return "";
  };
  const nested = (body.resident ?? body.Resident) as Record<string, unknown> | undefined;
  const nestedText = (...keys: string[]) => {
    if (!nested) return "";
    for (const key of keys) {
      const value = nested[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const token = text("token", "Token", "accessToken");
  const residentId = text("residentId", "ResidentId") || nestedText("id", "Id");
  const societyId =
    text("societyId", "SocietyId") || nestedText("societyId", "SocietyId");
  if (!token || !residentId || !societyId) {
    throw new Error("The sign-in response is incomplete. Please try again.");
  }

  return {
    token,
    residentId,
    societyId,
    fullName: text("fullName", "FullName") || undefined,
    phoneNumber: text("phoneNumber", "PhoneNumber") || phoneNumber,
    towerWing: text("towerWing", "TowerWing") || undefined,
    flatNumber: text("flatNumber", "FlatNumber") || undefined,
  };
}
