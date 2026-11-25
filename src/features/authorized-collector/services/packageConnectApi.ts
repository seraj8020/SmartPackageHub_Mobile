import { API, apiFetch, authHeaders } from "@/shared/services/apiClient";

export type AuthorizedCollector = {
  id: string;
  packageId: string;
  collectorName: string;
  collectorPhone?: string;
  note?: string;
  authorizedAtUtc: string;
  expiresAtUtc?: string;
  isActive: boolean;
};

export type AuthorizeCollectorRequest = {
  collectorName: string;
  collectorPhone?: string;
  note?: string;
  expiresAtUtc?: string;
};

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

async function readError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as { message?: string; Message?: string };
  throw new Error(body.message ?? body.Message ?? fallback);
}

function mapCollector(row: Record<string, unknown>): AuthorizedCollector {
  return {
    id: textOf(row, "id", "Id"),
    packageId: textOf(row, "packageId", "PackageId"),
    collectorName: textOf(row, "collectorName", "CollectorName"),
    collectorPhone: textOf(row, "collectorPhone", "CollectorPhone") || undefined,
    note: textOf(row, "note", "Note") || undefined,
    authorizedAtUtc: textOf(row, "authorizedAtUtc", "AuthorizedAtUtc"),
    expiresAtUtc: textOf(row, "expiresAtUtc", "ExpiresAtUtc") || undefined,
    isActive: row.isActive === true || row.IsActive === true,
  };
}

export async function authorizePackageCollector(
  residentId: string,
  packageId: string,
  request: AuthorizeCollectorRequest,
): Promise<void> {
  const response = await apiFetch(
    `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}/authorized-collector`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) await readError(response, `Unable to authorize collector (${response.status})`);
}

export async function revokePackageCollector(residentId: string, packageId: string): Promise<void> {
  const response = await apiFetch(
    `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}/authorized-collector/revoke`,
    {
      method: "POST",
      headers: await authHeaders(),
    },
  );
  if (!response.ok) await readError(response, `Unable to revoke collector (${response.status})`);
}

export { mapCollector };
