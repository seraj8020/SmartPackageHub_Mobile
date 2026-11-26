import { API, authHeaders } from "@/shared/services/apiClient";
import type { SupportTicket } from "@/features/resident-support/models/support.types";

export type ResidentSupportConfig = {
  supportEmail: string;
  supportPhone?: string;
};

export type CreateSupportRequestInput = {
  residentId: string;
  societyId?: string;
  subject: string;
  category: string;
  urgency: string;
  message: string;
  residentName?: string;
  residentPhone?: string;
  towerWing?: string;
  flatNumber?: string;
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

function mapTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: textOf(row, "id", "Id"),
    referenceCode: textOf(row, "referenceCode", "ReferenceCode"),
    subject: textOf(row, "subject", "Subject"),
    category: textOf(row, "category", "Category", "topic", "Topic"),
    urgency: textOf(row, "urgency", "Urgency") || "Normal",
    message: textOf(row, "message", "Message"),
    status: textOf(row, "status", "Status") || "Open",
    supportEmail: textOf(row, "supportEmail", "SupportEmail") || undefined,
    requestedAtUtc: textOf(row, "requestedAtUtc", "RequestedAtUtc"),
  };
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

export async function listSupportRequests(residentId: string): Promise<SupportTicket[]> {
  const response = await fetch(
    `${API}/support/requests?residentId=${encodeURIComponent(residentId)}`,
    { headers: await authHeaders() },
  );
  if (!response.ok) await readError(response, `Unable to load support requests (${response.status})`);
  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((row) => mapTicket((row ?? {}) as Record<string, unknown>));
}

export async function createSupportRequest(
  input: CreateSupportRequestInput,
): Promise<SupportTicket> {
  const response = await fetch(`${API}/support/requests`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      residentId: input.residentId,
      ...(input.societyId ? { societyId: input.societyId } : {}),
      subject: input.subject,
      category: input.category,
      urgency: input.urgency,
      message: input.message,
      residentName: input.residentName,
      residentPhone: input.residentPhone,
      towerWing: input.towerWing,
      flatNumber: input.flatNumber,
    }),
  });
  if (!response.ok) await readError(response, `Unable to submit support request (${response.status})`);
  return mapTicket((await response.json()) as Record<string, unknown>);
}
