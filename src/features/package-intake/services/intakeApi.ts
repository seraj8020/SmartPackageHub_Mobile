import { API, authHeaders, authTokenHeader } from "@/shared/services/apiClient";

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
  const response = await fetch(`${API}/intake/match?${params.toString()}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Directory lookup failed (${response.status})`);
  return response.json() as Promise<MatchResponse>;
}

export async function searchResidents(
  query: string,
  societyId?: string,
): Promise<ResidentMatch[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (societyId) params.set("societyId", societyId);
  const qs = params.toString();
  const response = await fetch(`${API}/intake/residents${qs ? `?${qs}` : ""}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) await readError(response, `Resident search failed (${response.status})`);
  return response.json() as Promise<ResidentMatch[]>;
}

/** Carrier names for the scan courier dropdown from society CourierAgents (DB). */
export async function getIntakeCarriers(societyId?: string | null): Promise<string[]> {
  const params = new URLSearchParams();
  if (societyId) params.set("societyId", societyId);
  const qs = params.toString();
  const response = await fetch(`${API}/intake/carriers${qs ? `?${qs}` : ""}`, {
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
  const carriers = rows.map((item) => String(item)).filter((item) => item.trim().length > 0);
  return carriers.length > 0 ? carriers : [...OTHER_ONLY];
}

export async function confirmIntake(
  payload: ConfirmIntakePayload,
): Promise<ConfirmIntakeResult> {
  const response = await fetch(`${API}/intake/confirm`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
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
  const response = await fetch(`${API}/intake/batch-intake`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ items }),
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

export async function suggestShelf(societyId?: string): Promise<{ shelfCode: string }> {
  const params = new URLSearchParams();
  if (societyId) params.set("societyId", societyId);
  const query = params.toString();
  const response = await fetch(`${API}/intake/shelf${query ? `?${query}` : ""}`, {
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
  const response = await fetch(`${API}/packages/${encodeURIComponent(packageId)}/shelf`, {
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
  const response = await fetch(
    `${API}/packages/${encodeURIComponent(packageId)}/cod/approve`,
    { method: "POST", headers: await authHeaders() },
  );
  if (!response.ok) await readError(response, `COD approval failed (${response.status})`);
  return response.json() as Promise<{ succeeded: boolean; message?: string; pickupOtp?: string }>;
}

export async function rejectCod(
  packageId: string,
): Promise<{ succeeded: boolean; message?: string }> {
  const response = await fetch(
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
  const response = await fetch(`${API}/intake/${intakeId}/damage`, {
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
  const form = new FormData();
  form.append("clientPhotoId", clientPhotoId);
  form.append("file", {
    uri,
    name: "parcel.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  const response = await fetch(`${API}/intake/photos`, {
    method: "POST",
    headers: await authTokenHeader(),
    body: form,
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
