import { API, authHeaders } from "@/shared/services/apiClient";

export type ResidentSupportConfig = {
  supportEmail: string;
  supportPhone?: string;
};

export type CreateSupportRequestInput = {
  residentId: string;
  societyId: string;
  topic: string;
  message: string;
  residentName?: string;
  residentPhone?: string;
  towerWing?: string;
  flatNumber?: string;
};

export type CreateSupportRequestResult = {
  id: string;
  status: string;
  supportEmail: string;
  requestedAtUtc: string;
  message: string;
};

async function readError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as { message?: string; Message?: string };
  throw new Error(body.message ?? body.Message ?? fallback);
}

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

export async function getResidentSupportConfig(): Promise<ResidentSupportConfig> {
  const response = await fetch(`${API}/support/config`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Unable to load support config (${response.status})`);
  const row = (await response.json()) as Record<string, unknown>;
  return {
    supportEmail: textOf(row, "supportEmail", "SupportEmail") || "hello@byonverse.com",
    supportPhone: textOf(row, "supportPhone", "SupportPhone") || undefined,
  };
}

export async function createSupportRequest(
  input: CreateSupportRequestInput,
): Promise<CreateSupportRequestResult> {
  const response = await fetch(`${API}/support/requests`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      residentId: input.residentId,
      societyId: input.societyId,
      topic: input.topic,
      message: input.message,
      residentName: input.residentName,
      residentPhone: input.residentPhone,
      towerWing: input.towerWing,
      flatNumber: input.flatNumber,
    }),
  });
  if (!response.ok) await readError(response, `Unable to submit support request (${response.status})`);
  const row = (await response.json()) as Record<string, unknown>;
  return {
    id: textOf(row, "id", "Id"),
    status: textOf(row, "status", "Status"),
    supportEmail: textOf(row, "supportEmail", "SupportEmail"),
    requestedAtUtc: textOf(row, "requestedAtUtc", "RequestedAtUtc"),
    message: textOf(row, "message", "Message") || "Support request received.",
  };
}
