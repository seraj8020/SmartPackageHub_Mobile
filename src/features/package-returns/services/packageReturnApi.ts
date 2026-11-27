import type {
  PackageReturnReason,
  RequestPackageReturnResponse,
  StaffPackageReturn,
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

/** Lists open return requests for a staff member's assigned society. */
export async function getSocietyPackageReturns(societyId: string): Promise<StaffPackageReturn[]> {
  const response = await apiFetch(
    `${API}/societies/${encodeURIComponent(societyId)}/returns?openOnly=true`,
    { headers: await authHeaders() },
  );
  const body = await response.json().catch(() => ({})) as unknown;
  if (!response.ok) {
    const row = (body ?? {}) as Record<string, unknown>;
    throw new Error(textOf(row, "message", "Message") || `Unable to load return requests (${response.status}).`);
  }

  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown> | null)?.data)
      ? (body as { data: unknown[] }).data
      : [];
  return rows.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: textOf(row, "id", "Id"),
      packageId: textOf(row, "packageId", "PackageId"),
      residentId: textOf(row, "residentId", "ResidentId"),
      societyId: textOf(row, "societyId", "SocietyId") || societyId,
      status: textOf(row, "status", "Status"),
      reason: textOf(row, "reason", "Reason"),
      note: textOf(row, "note", "Note") || undefined,
      requestedAtUtc: textOf(row, "requestedAtUtc", "RequestedAtUtc") || undefined,
      pkgNumber: textOf(row, "pkgNumber", "PkgNumber") || undefined,
      courierPartner: textOf(row, "courierPartner", "CourierPartner") || undefined,
      courierAwb: textOf(row, "courierAwb", "CourierAwb") || undefined,
      residentName: textOf(row, "residentName", "ResidentName") || undefined,
      unit: textOf(row, "unit", "Unit") || undefined,
      hasHubIntakeDamage: row.hasHubIntakeDamage === true || row.HasHubIntakeDamage === true,
      hubIntakeDamageNote: textOf(row, "hubIntakeDamageNote", "HubIntakeDamageNote") || undefined,
      photos: Array.isArray(row.photos ?? row.Photos)
        ? ((row.photos ?? row.Photos) as unknown[]).map((photo) => ({
            id: textOf((photo ?? {}) as Record<string, unknown>, "id", "Id"),
          })).filter((photo) => photo.id.length > 0)
        : [],
    };
  }).filter((item) => item.id && item.packageId);
}
