import type {
  PackageReturnReason,
  RequestPackageReturnResponse,
} from "@/features/package-returns/models/packageReturn.types";
import { API, apiFetch, authHeaders } from "@/shared/services/apiClient";

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

/** Request a resident return for a delivered package. */
export async function requestPackageReturn(
  packageId: string,
  residentId: string,
  reason: PackageReturnReason = "DamagedInside",
  note?: string,
): Promise<RequestPackageReturnResponse> {
  const response = await apiFetch(`${API}/packages/${encodeURIComponent(packageId)}/returns`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      residentId,
      reason,
      ...(note?.trim() ? { note: note.trim() } : {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      textOf(body, "message", "Message") || `Unable to request return (${response.status}).`,
    );
  }
  return {
    id: textOf(body, "id", "Id") || undefined,
    packageId: textOf(body, "packageId", "PackageId") || packageId,
    status: textOf(body, "status", "Status") || "ReturnRequested",
    message: textOf(body, "message", "Message") || "Return request received.",
  };
}
