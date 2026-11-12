import { API, authHeaders } from "@/shared/services/apiClient";
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
      userId: "00000000-0000-0000-0000-000000000000",
      fullname: request.fullName,
      phoneNo: request.phoneNumber,
      towerWing: request.towerWing,
      flatNumber: request.flatNumber,
      isMember: true,
      picUrl: "",
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
  const response = await fetch(`${API}/auth/resident/otp/verify`, {
    method: "POST",
    headers: await authHeaders(),
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

  const body = (await response.json()) as {
    token?: string;
    Token?: string;
    accessToken?: string;
    residentId?: string;
    ResidentId?: string;
    societyId?: string;
    SocietyId?: string;
    fullName?: string;
    FullName?: string;
    phoneNumber?: string;
    PhoneNumber?: string;
    towerWing?: string;
    TowerWing?: string;
    flatNumber?: string;
    FlatNumber?: string;
    resident?: { id?: string; societyId?: string };
  };

  const token = body.token ?? body.Token ?? body.accessToken;
  const residentId = body.residentId ?? body.ResidentId ?? body.resident?.id;
  const societyId = body.societyId ?? body.SocietyId ?? body.resident?.societyId;
  if (!token || !residentId || !societyId) {
    throw new Error("The sign-in response is incomplete. Please try again.");
  }

  return {
    token,
    residentId,
    societyId,
    fullName: body.fullName ?? body.FullName,
    phoneNumber: body.phoneNumber ?? body.PhoneNumber ?? phoneNumber,
    towerWing: body.towerWing ?? body.TowerWing,
    flatNumber: body.flatNumber ?? body.FlatNumber,
  };
}
