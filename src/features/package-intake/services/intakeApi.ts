import * as FileSystem from "expo-file-system/legacy";
import { API, apiFetch, authHeaders } from "@/shared/services/apiClient";

const OTHER_ONLY = ["Other"] as const;

export interface ResidentMatch {
  id: string;
  name: string;
  tower?: string | null;
  flatNumber?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  phoneNumber?: string | null;
  unit: string;
}

export interface MatchResponse {
  status: "matched" | "ambiguous" | "missing" | string;
  matches: ResidentMatch[];
}

export interface ConfirmIntakePayload {
  awb: string;
  barcode?: string;
  courier?: string;
  recipientName?: string;
  tower?: string;
  flatNumber?: string;
  residentId?: string;
  societyId?: string;
  shelfCode?: string;
  staffUserId?: string;
  staffName?: string;
  rawOcrText?: string;
  ocrElapsedMs?: number;
  clientRequestId: string;
  clientPhotoId?: string;
  /** Local file URI for deferred arrival upload (offline queue only — never sent to API). */
  localArrivalPhotoUri?: string;
  isDamaged: boolean;
  damageNote?: string;
  matchStatus: string;
  category?: string;
  isColdStorage: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  isCod?: boolean;
  codAmount?: number;
}

/** Strip client-only fields before POST /intake/confirm or batch. */
export function toApiConfirmPayload(payload: ConfirmIntakePayload): ConfirmIntakePayload {
  const { localArrivalPhotoUri: _local, ...apiPayload } = payload;
  return apiPayload;
}

export interface ConfirmIntakeResult {
  intakeId: string;
  packageId: string;
  pkgNumber: string;
  awb: string;
  courier?: string | null;
  shelfCode: string;
  status?: string;
  isCod?: boolean;
  codAmount?: number;
  codApprovalStatus?: string;
  pickupOtp?: string | null;
  pickupQrPayload: string;
  notificationStatus: string;
  matchStatus: string;
  photoStored: boolean;
  resident?: ResidentMatch | null;
  /** Present when saved locally and waiting for sync. */
  queuedOffline?: boolean;
}

async function readError(response: Response, fallback: string): Promise<never> {
  const err = (await response.json().catch(() => ({}))) as {
    message?: string;
    Message?: string;
  };
  throw new Error(err.message ?? err.Message ?? fallback);
}

function normalizeResidentMatch(raw: unknown): ResidentMatch {
  const row = (raw ?? {}) as Record<string, unknown>;
  const pick = (camel: string, pascal: string) => row[camel] ?? row[pascal];
  const tower = (pick("tower", "Tower") as string | null | undefined) ?? null;
  const flatNumber = (pick("flatNumber", "FlatNumber") as string | null | undefined) ?? null;
  const name = String(pick("name", "Name") ?? "").trim();
  const unitRaw = String(pick("unit", "Unit") ?? "").trim();
  const unit =
    unitRaw ||
    [tower, flatNumber].filter(Boolean).join("-") ||
    name ||
    "Resident";
  return {
    id: String(pick("id", "Id") ?? ""),
    name: name || unit,
    tower,
    flatNumber,
    avatarUrl: (pick("avatarUrl", "AvatarUrl") as string | null | undefined) ?? null,
    isActive: Boolean(pick("isActive", "IsActive") ?? true),
    phoneNumber: (pick("phoneNumber", "PhoneNumber") as string | null | undefined) ?? null,
    unit,
  };
}

export async function matchResident(query: {
  tower?: string;
  flat?: string;
  name?: string;
  societyId?: string;
}): Promise<MatchResponse> {
  const params = new URLSearchParams();
  if (query.tower) params.set("tower", query.tower);
  if (query.flat) params.set("flat", query.flat);
  if (query.name) params.set("name", query.name);
  if (query.societyId) params.set("societyId", query.societyId);
  const response = await apiFetch(`${API}/intake/match?${params.toString()}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Directory lookup failed (${response.status})`);
  const body = (await response.json()) as {
    status?: string;
    Status?: string;
    matches?: unknown[];
    Matches?: unknown[];
  };
  const matches = (body.matches ?? body.Matches ?? []).map(normalizeResidentMatch);
  return {
    status: String(body.status ?? body.Status ?? "missing"),
    matches,
  };
}

export async function searchResidents(
  query: string,
  societyId?: string,
): Promise<ResidentMatch[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (societyId) params.set("societyId", societyId);
  const qs = params.toString();
  const response = await apiFetch(`${API}/intake/residents${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Resident search failed (${response.status})`);
  const body = (await response.json()) as unknown;
  const rows = Array.isArray(body) ? body : [];
  return rows.map(normalizeResidentMatch);
}

/** Carrier names for the scan courier dropdown from society CourierAgents (DB). */
export async function getIntakeCarriers(societyId?: string | null): Promise<string[]> {
  const params = new URLSearchParams();
  if (societyId) params.set("societyId", societyId);
  const qs = params.toString();
  const response = await apiFetch(`${API}/intake/carriers${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    // Keep intake usable, but do not invent courier brands.
    return [...OTHER_ONLY];
  }
  const body = (await response.json()) as unknown;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown })?.data)
      ? ((body as { data: unknown[] }).data)
      : [];
  const carriers = rows
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return sortCarriersForDropdown(carriers.length > 0 ? carriers : [...OTHER_ONLY]);
}

/** A–Z (case-insensitive), with "Other" always last. */
export function sortCarriersForDropdown(carriers: readonly string[]): string[] {
  const unique = Array.from(
    new Map(carriers.map((name) => [name.toLowerCase(), name])).values(),
  );
  const named = unique
    .filter((name) => name.toLowerCase() !== "other")
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...named, "Other"];
}

export async function confirmIntake(
  payload: ConfirmIntakePayload,
): Promise<ConfirmIntakeResult> {
  const response = await apiFetch(`${API}/intake/confirm`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(toApiConfirmPayload(payload)),
  });
  if (!response.ok) await readError(response, `Intake failed (${response.status})`);
  return normalizeIntakeResult(await response.json());
}

export interface BatchIntakeItemResult {
  clientRequestId?: string | null;
  awb?: string | null;
  succeeded: boolean;
  statusCode: number;
  error?: string | null;
  intake?: ConfirmIntakeResult | null;
}

export interface BatchIntakeResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchIntakeItemResult[];
}

/** Offline queue flush — POST /api/v2/intake/batch-intake */
export async function batchConfirmIntake(
  items: ConfirmIntakePayload[],
): Promise<BatchIntakeResult> {
  const response = await apiFetch(`${API}/intake/batch-intake`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ items: items.map(toApiConfirmPayload) }),
  });
  if (!response.ok) await readError(response, `Batch intake failed (${response.status})`);
  const body = (await response.json()) as Record<string, unknown>;
  const rawResults = (body.results ?? body.Results ?? []) as Record<string, unknown>[];
  return {
    total: Number(body.total ?? body.Total ?? rawResults.length),
    succeeded: Number(body.succeeded ?? body.Succeeded ?? 0),
    failed: Number(body.failed ?? body.Failed ?? 0),
    results: rawResults.map((row) => {
      const intakeRaw = (row.intake ?? row.Intake) as Record<string, unknown> | null | undefined;
      return {
        clientRequestId: (row.clientRequestId ?? row.ClientRequestId) as string | null | undefined,
        awb: (row.awb ?? row.Awb) as string | null | undefined,
        succeeded: Boolean(row.succeeded ?? row.Succeeded),
        statusCode: Number(row.statusCode ?? row.StatusCode ?? 0),
        error: (row.error ?? row.Error) as string | null | undefined,
        intake: intakeRaw ? normalizeIntakeResult(intakeRaw) : null,
      };
    }),
  };
}

export async function suggestShelf(
  societyId?: string,
  options?: { towerOrWing?: string | null; isColdStorage?: boolean },
): Promise<{ shelfCode: string }> {
  const params = new URLSearchParams();
  if (societyId) params.set("societyId", societyId);
  if (options?.towerOrWing?.trim()) params.set("towerOrWing", options.towerOrWing.trim());
  if (options?.isColdStorage != null) {
    params.set("isColdStorage", String(options.isColdStorage));
  }
  const query = params.toString();
  const response = await apiFetch(`${API}/intake/shelf${query ? `?${query}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Shelf suggestion failed (${response.status})`);
  const body = (await response.json()) as { shelfCode?: string; ShelfCode?: string };
  return { shelfCode: body.shelfCode ?? body.ShelfCode ?? "" };
}

export async function assignShelf(
  packageId: string,
  shelfCode: string,
  isColdStorage = false,
): Promise<ConfirmIntakeResult> {
  const response = await apiFetch(`${API}/packages/${encodeURIComponent(packageId)}/shelf`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ shelfCode, isColdStorage }),
  });
  if (!response.ok) await readError(response, `Shelf assignment failed (${response.status})`);
  return normalizeIntakeResult(await response.json());
}

export async function approveCod(
  packageId: string,
): Promise<{ succeeded: boolean; message?: string; pickupOtp?: string }> {
  const response = await apiFetch(
    `${API}/packages/${encodeURIComponent(packageId)}/cod/approve`,
    { method: "POST", headers: await authHeaders() },
  );
  if (!response.ok) await readError(response, `COD approval failed (${response.status})`);
  return response.json() as Promise<{ succeeded: boolean; message?: string; pickupOtp?: string }>;
}

export async function rejectCod(
  packageId: string,
): Promise<{ succeeded: boolean; message?: string }> {
  const response = await apiFetch(
    `${API}/packages/${encodeURIComponent(packageId)}/cod/reject`,
    { method: "POST", headers: await authHeaders() },
  );
  if (!response.ok) await readError(response, `COD rejection failed (${response.status})`);
  return response.json() as Promise<{ succeeded: boolean; message?: string }>;
}

export async function uploadDamagePhoto(
  intakeId: string,
  imageBase64: string,
  note?: string,
): Promise<void> {
  // Camera preview stores a data URL; API expects raw base64 only.
  const marker = "base64,";
  const markerIndex = imageBase64.indexOf(marker);
  const payload =
    markerIndex >= 0 ? imageBase64.slice(markerIndex + marker.length) : imageBase64;
  const response = await apiFetch(`${API}/intake/${intakeId}/damage`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ imageBase64: payload, note }),
  });
  if (!response.ok) await readError(response, `Damage photo failed (${response.status})`);
}

export async function uploadParcelPhoto(
  clientPhotoId: string,
  uri: string,
): Promise<{ clientPhotoId: string; storageKey: string; linked: boolean }> {
  // Same proven path as damage photos — JSON base64 (no FormData / Blob / multipart Content-Type).
  const imageBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const response = await apiFetch(`${API}/intake/photos/base64`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      clientPhotoId,
      imageBase64,
      contentType: "image/jpeg",
    }),
  });
  if (!response.ok) await readError(response, `Parcel photo failed (${response.status})`);
  return response.json() as Promise<{
    clientPhotoId: string;
    storageKey: string;
    linked: boolean;
  }>;
}

function normalizeIntakeResult(body: Record<string, unknown>): ConfirmIntakeResult {
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
    }
    return "";
  };
  const bool = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "boolean") return value;
    }
    return false;
  };
  const num = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }
    return undefined;
  };
  const residentRaw = (body.resident ?? body.Resident) as
    | Record<string, unknown>
    | null
    | undefined;
  return {
    intakeId: text("intakeId", "IntakeId"),
    packageId: text("packageId", "PackageId"),
    pkgNumber: text("pkgNumber", "PkgNumber"),
    awb: text("awb", "Awb"),
    courier: text("courier", "Courier") || null,
    shelfCode: text("shelfCode", "ShelfCode"),
    status: text("status", "Status") || undefined,
    isCod: bool("isCod", "IsCod"),
    codAmount: num("codAmount", "CodAmount"),
    codApprovalStatus: text("codApprovalStatus", "CodApprovalStatus") || undefined,
    pickupOtp: text("pickupOtp", "PickupOtp") || null,
    pickupQrPayload: text("pickupQrPayload", "PickupQrPayload"),
    notificationStatus: text("notificationStatus", "NotificationStatus") || "Queued",
    matchStatus: text("matchStatus", "MatchStatus") || "missing",
    photoStored: bool("photoStored", "PhotoStored"),
    resident: residentRaw
      ? {
          id: String(residentRaw.id ?? residentRaw.Id ?? ""),
          name: String(residentRaw.name ?? residentRaw.Name ?? ""),
          tower: (residentRaw.tower ?? residentRaw.Tower) as string | null | undefined,
          flatNumber: (residentRaw.flatNumber ?? residentRaw.FlatNumber) as
            | string
            | null
            | undefined,
          avatarUrl: (residentRaw.avatarUrl ?? residentRaw.AvatarUrl) as
            | string
            | null
            | undefined,
          isActive: Boolean(residentRaw.isActive ?? residentRaw.IsActive ?? true),
          phoneNumber: (residentRaw.phoneNumber ?? residentRaw.PhoneNumber) as
            | string
            | null
            | undefined,
          unit: String(residentRaw.unit ?? residentRaw.Unit ?? ""),
        }
      : null,
  };
}
