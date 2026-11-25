import { API, apiFetch, authHeaders, authTokenHeader } from "@/shared/services/apiClient";

export interface Society {
  id: string;
  name: string;
}

export type PackageLifecycleStatus = "Received" | "Shelved" | "Dispatched" | "Delivered" | string;
export type CodApprovalStatus = "None" | "Pending" | "Approved" | "Rejected" | string;

export interface HubPackage {
  id: string;
  residentId?: string;
  staffUserId?: string;
  recipientName?: string;
  courier: string;
  tracking: string;
  /** Alias used by older mobile screens. */
  trackingNumber?: string;
  /** Courier AWB / airway bill when distinct from SPH tracking. */
  courierAwb?: string;
  tower?: string;
  towerWing?: string;
  floor?: number;
  flat: string;
  flatNumber?: string;
  weight: string;
  /** Package dimensions in cm (from intake OCR / staff entry). */
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  receivedAt: string;
  deliveredAt?: string;
  category: string;
  shelfCode?: string;
  /** Hub shelf tower/wing (allocation), distinct from resident towerWing. */
  shelfTowerOrWing?: string;
  shelfZone?: string;
  /** Rack / aisle on the hub shelf. */
  shelfAisle?: string;
  shelfTier?: number;
  shelfCapacity?: number;
  isColdStorage?: boolean;
  status?: PackageLifecycleStatus;
  isCod?: boolean;
  codAmount?: number;
  codApprovalStatus?: CodApprovalStatus;
  pkgNumber?: string;
  deliverySlotStatus?: string;
  deliverySlotLabel?: string;
  preferredDeliveryMethod?: "DoorDelivery" | "CounterPickup" | string;
  isDamaged?: boolean;
  damageNote?: string;
  damagePhotoUrl?: string;
  /** Hub arrival / parcel photo captured at intake (all packages when available). */
  arrivalPhotoUrl?: string;
  /** True when PackageImage exists — open package detail to view the photo. */
  hasArrivalPhoto?: boolean;
  /** Active authorized collector for pickup on behalf of the resident. */
  authorizedCollectorName?: string;
  authorizedCollectorPhone?: string;
  authorizedCollectorNote?: string;
  authorizedCollectorId?: string;
  authorizedCollectorExpiresAtUtc?: string;
}

export interface ResidentPackageDetail extends HubPackage {
  isDamaged: boolean;
  damageNote?: string;
  damagePhotoUrl?: string;
  arrivalPhotoUrl?: string;
}

export interface HistoryItem {
  id: string;
  courier: string;
  collectedAt: string;
  category: string;
  method: string;
  pkgNumber?: string;
  /** SPH tracking number. */
  trackingNumber?: string;
  /** Courier AWB / airway bill. */
  courierAwb?: string;
  methodOfDelivery?: string;
}

export interface PackageStatusUpdateResponse {
  success: boolean;
  packageId: string;
  message?: string;
}

export type DeliveryMethod = "DoorDelivery" | "CounterPickup";

export interface DeliverPackageRequest {
  token: string;
  method: DeliveryMethod;
  /** Optional staff evidence note (shown as Traizr-style evidence note). */
  notes?: string;
  /** Base64 JPEG handover photo (with or without data-URL prefix). */
  photoBase64?: string;
  /** Base64 SVG/PNG resident signature. */
  signatureBase64?: string;
  /** Name under the signature pad. */
  signedByName?: string;
}

export interface StartTowerRouteResponse {
  message: string;
  dispatchedCount: number;
  packageIds: string[];
}

function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key] ?? row[Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase()) ?? ""];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function objectOf(row: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const candidateKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = candidateKey ? row[candidateKey] : undefined;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function absoluteApiUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  try {
    return new URL(value, `${API}/`).toString();
  } catch {
    return undefined;
  }
}

function damageFields(row: Record<string, unknown>) {
  const envelope = objectOf(row, "data", "result", "package") ?? row;
  const hubIntake = objectOf(row, "hubIntakeNote", "HubIntakeNote", "intake", "packageIntake")
    ?? objectOf(envelope, "hubIntakeNote", "HubIntakeNote", "intake", "packageIntake");
  const hubArrival = objectOf(row, "hubArrivalPhoto", "HubArrivalPhoto")
    ?? objectOf(envelope, "hubArrivalPhoto", "HubArrivalPhoto");
  const isDamaged = envelope.isDamaged === true || envelope.IsDamaged === true ||
    hubIntake?.isDamaged === true || hubIntake?.IsDamaged === true ||
    row.isDamaged === true || row.IsDamaged === true;
  // This is the API's canonical shape: hubIntakeNote.damageNote.
  const damageNote = (hubIntake ? textOf(hubIntake,
    "damageNote", "DamageNote", "staffDamageNote", "StaffDamageNote", "staffNote", "StaffNote",
    "damageDescription", "DamageDescription") : "") ||
    textOf(envelope, "damageNote", "DamageNote", "staffDamageNote", "StaffDamageNote", "staffNote", "StaffNote") || undefined;
  const damagePhotoUrl = absoluteApiUrl((hubIntake ? textOf(hubIntake,
    "damagePhotoUrl", "DamagePhotoUrl", "damagePhotoURL", "DamagePhotoURL",
    "photoUrl", "PhotoUrl", "signedUrl", "SignedUrl", "url", "Url") : "") || textOf(envelope,
    "damagePhotoUrl", "DamagePhotoUrl", "damagePhotoURL", "DamagePhotoURL",
    "photoUrl", "PhotoUrl", "signedUrl", "SignedUrl", "url", "Url") || undefined);
  const arrivalPhotoUrl = absoluteApiUrl((hubArrival ? textOf(hubArrival,
    "arrivalPhotoUrl", "ArrivalPhotoUrl", "photoUrl", "PhotoUrl",
    "signedUrl", "SignedUrl", "url", "Url") : "") || textOf(envelope,
    "arrivalPhotoUrl", "ArrivalPhotoUrl") || undefined);
  return { isDamaged, damageNote, damagePhotoUrl, arrivalPhotoUrl };
}

function positiveDimension(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = row[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

export function toHubPackage(row: Record<string, unknown>): HubPackage {
  const tower = textOf(row, "towerWing", "TowerWing", "tower", "Tower");
  const flat = textOf(row, "flatNumber", "FlatNumber", "flat", "Flat");
  const floorValue = row.floor ?? row.Floor;
  const weight = textOf(row, "weight", "Weight");
  const pkgNumber = textOf(row, "pkgNumber", "PkgNumber") || undefined;
  const tracking =
    textOf(row, "tracking", "Tracking", "trackingNumber", "TrackingNumber") ||
    "—";
  const courierAwb = textOf(row, "courierAwb", "CourierAwb", "awb", "Awb") || undefined;
  const isCodRaw = row.isCod ?? row.IsCod;
  const codAmountRaw = row.codAmount ?? row.CodAmount;
  const damage = damageFields(row);
  return {
    id: textOf(row, "id", "Id"),
    residentId: textOf(row, "residentId", "ResidentId") || undefined,
    staffUserId: textOf(row, "staffUserId", "StaffUserId") || undefined,
    recipientName: textOf(row, "recipientName", "RecipientName") || undefined,
    courier: textOf(row, "courier", "Courier", "courierPartner") || "Courier",
    tracking,
    trackingNumber: tracking,
    courierAwb,
    tower: tower || undefined,
    towerWing: tower || undefined,
    floor: typeof floorValue === "number" && Number.isFinite(floorValue) ? floorValue : undefined,
    flat,
    flatNumber: flat || undefined,
    weight: weight ? `${weight.replace(/\s*kg$/i, "")} kg` : "",
    lengthCm: positiveDimension(row, "length", "Length", "lengthCm", "LengthCm"),
    widthCm: positiveDimension(row, "width", "Width", "widthCm", "WidthCm"),
    heightCm: positiveDimension(row, "height", "Height", "heightCm", "HeightCm"),
    receivedAt:
      textOf(row, "receivedAt", "ReceivedAt", "recievedAt", "RecievedAt") ||
      new Date().toISOString(),
    deliveredAt: textOf(row, "deliveredAt", "DeliveredAt") || undefined,
    category: textOf(row, "category", "Category", "description") || "Miscellaneous",
    shelfCode: textOf(row, "shelfCode", "ShelfCode") || undefined,
    shelfTowerOrWing:
      textOf(row, "shelfTowerOrWing", "ShelfTowerOrWing") || undefined,
    shelfZone: textOf(row, "shelfZone", "ShelfZone") || undefined,
    shelfAisle: textOf(row, "shelfAisle", "ShelfAisle") || undefined,
    shelfTier: (() => {
      const raw = row.shelfTier ?? row.ShelfTier;
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    })(),
    shelfCapacity: Number(row.shelfCapacity ?? row.ShelfCapacity) || undefined,
    isColdStorage: row.isColdStorage === true || row.IsColdStorage === true,
    status: textOf(row, "status", "Status") || undefined,
    isCod: typeof isCodRaw === "boolean" ? isCodRaw : undefined,
    codAmount:
      typeof codAmountRaw === "number" ? codAmountRaw : Number(codAmountRaw) || undefined,
    codApprovalStatus: textOf(row, "codApprovalStatus", "CodApprovalStatus") || undefined,
    pkgNumber,
    deliverySlotStatus: textOf(row, "deliverySlotStatus", "DeliverySlotStatus") || undefined,
    deliverySlotLabel: textOf(row, "deliverySlotLabel", "DeliverySlotLabel") || undefined,
    preferredDeliveryMethod:
      textOf(row, "preferredDeliveryMethod", "PreferredDeliveryMethod") || undefined,
    hasArrivalPhoto:
      row.hasArrivalPhoto === true ||
      row.HasArrivalPhoto === true ||
      Boolean(damage.arrivalPhotoUrl),
    authorizedCollectorName:
      textOf(row, "authorizedCollectorName", "AuthorizedCollectorName") || undefined,
    authorizedCollectorPhone:
      textOf(row, "authorizedCollectorPhone", "AuthorizedCollectorPhone") || undefined,
    authorizedCollectorNote:
      textOf(row, "authorizedCollectorNote", "AuthorizedCollectorNote") || undefined,
    ...damage,
  };
}

export async function getSocieties(): Promise<Society[]> {
  const response = await apiFetch(`${API}/societies`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(err.message ?? err.Message ?? `Failed to fetch societies (${response.status})`);
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: textOf(row, "id", "Id"),
    name: textOf(row, "name", "Name"),
  }));
}

export async function getResidentPackages(residentId: string): Promise<HubPackage[]> {
  const response = await apiFetch(
    `${API}/residents/${encodeURIComponent(residentId)}/packages`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(
      err.message ?? err.Message ?? `Failed to fetch resident packages (${response.status})`,
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(toHubPackage);
}

/** Loads owner-scoped package detail, including hub damage information when present. */
export async function getResidentPackageDetail(
  residentId: string,
  packageId: string,
): Promise<ResidentPackageDetail> {
  const endpoint = `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}`;
  const response = await apiFetch(
    endpoint,
    { headers: await authHeaders() },
  );
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(`Failed to load package detail (${response.status})`);
  if (!body) throw new Error("Package detail response was empty or invalid JSON.");
  const row = body;
  const damage = damageFields(row);
  const packageRow = objectOf(row, "package", "Package", "data", "Data", "result", "Result") ?? row;
  const collector = objectOf(row, "authorizedCollector", "AuthorizedCollector");
  return {
    ...toHubPackage(packageRow),
    ...damage,
    authorizedCollectorId: collector
      ? textOf(collector, "id", "Id") || undefined
      : undefined,
    authorizedCollectorName: collector
      ? textOf(collector, "collectorName", "CollectorName") || undefined
      : textOf(row, "authorizedCollectorName", "AuthorizedCollectorName") || undefined,
    authorizedCollectorPhone: collector
      ? textOf(collector, "collectorPhone", "CollectorPhone") || undefined
      : textOf(row, "authorizedCollectorPhone", "AuthorizedCollectorPhone") || undefined,
    authorizedCollectorNote: collector
      ? textOf(collector, "note", "Note") || undefined
      : textOf(row, "authorizedCollectorNote", "AuthorizedCollectorNote") || undefined,
    authorizedCollectorExpiresAtUtc: collector
      ? textOf(collector, "expiresAtUtc", "ExpiresAtUtc") || undefined
      : undefined,
  };
}

/** Reissues the authorized damage photo URL without reloading package detail. */
export async function refreshDamagePhotoUrl(residentId: string, packageId: string): Promise<string> {
  const endpoint = `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}/damage-photo-url`;
  const response = await apiFetch(
    endpoint,
    { headers: await authHeaders() },
  );
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(`Failed to refresh damage photo (${response.status})`);
  if (!body) throw new Error("Damage photo URL response was empty or invalid JSON.");
  const url = absoluteApiUrl(textOf(body, "damagePhotoUrl", "DamagePhotoUrl", "url", "Url", "photoUrl", "PhotoUrl"));
  if (!url) throw new Error("Damage photo URL was not returned.");
  return url;
}

/** Reissues the authorized arrival photo URL without reloading package detail. */
export async function refreshArrivalPhotoUrl(residentId: string, packageId: string): Promise<string> {
  const endpoint = `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}/arrival-photo-url`;
  const response = await apiFetch(
    endpoint,
    { headers: await authHeaders() },
  );
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(`Failed to refresh arrival photo (${response.status})`);
  if (!body) throw new Error("Arrival photo URL response was empty or invalid JSON.");
  const url = absoluteApiUrl(textOf(body, "arrivalPhotoUrl", "ArrivalPhotoUrl", "url", "Url", "photoUrl", "PhotoUrl"));
  if (!url) throw new Error("Arrival photo URL was not returned.");
  return url;
}

/** Adds bearer authorization only for the API's authenticated local photo proxy. */
export async function damagePhotoRequestHeaders(photoUrl: string): Promise<Record<string, string> | undefined> {
  try {
    if (new URL(photoUrl).origin !== new URL(API).origin) return undefined;
    return authTokenHeader();
  } catch {
    return undefined;
  }
}

/** Same auth header helper for arrival photo proxy URLs. */
export const arrivalPhotoRequestHeaders = damagePhotoRequestHeaders;

/** Authenticated proxy URL for the hub arrival photo (inbox thumbnails + detail). */
export function residentArrivalPhotoProxyUrl(residentId: string, packageId: string): string {
  return `${API}/residents/${encodeURIComponent(residentId)}/packages/${encodeURIComponent(packageId)}/arrival-photo`;
}

/** Staff-authenticated arrival photo stream (Receive / Shelf / Handover thumbnails). */
export function staffArrivalPhotoProxyUrl(packageId: string): string {
  return `${API}/packages/${encodeURIComponent(packageId)}/arrival-photo`;
}

/** Returns packages that have been collected or delivered by a resident. */
export async function getResidentHistory(residentId: string): Promise<HistoryItem[]> {
  const response = await apiFetch(
    `${API}/residents/${encodeURIComponent(residentId)}/history`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(err.message ?? err.Message ?? `Failed to fetch history (${response.status})`);
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const method = textOf(row, "method", "Method", "methodOfDelivery", "MethodOfDelivery");
    return {
      id: textOf(row, "id", "Id") || textOf(row, "packageId", "PackageId"),
      courier: textOf(row, "courier", "Courier") || "Courier",
      collectedAt: textOf(row, "collectedAt", "CollectedAt", "deliveredAt", "DeliveredAt"),
      category: textOf(row, "category", "Category", "status", "Status") || "Miscellaneous",
      method,
      pkgNumber: textOf(row, "pkgNumber", "PkgNumber") || undefined,
      trackingNumber: textOf(row, "trackingNumber", "TrackingNumber") || undefined,
      courierAwb: textOf(row, "courierAwb", "CourierAwb", "awb", "Awb") || undefined,
      methodOfDelivery: method || undefined,
    };
  });
}

export async function getSocietyPackages(societyId: string): Promise<HubPackage[]> {
  const response = await apiFetch(
    `${API}/societies/${encodeURIComponent(societyId)}/packages`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string;
      Message?: string;
    };
    throw new Error(
      err.message ?? err.Message ?? `Failed to fetch society packages (${response.status})`,
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(toHubPackage);
}

export function getSocietyDispatchedPackages(societyId: string): Promise<HubPackage[]> {
  return getSocietyPackageList(societyId, "dispatchedpackages");
}

export function getSocietyDeliveredPackages(societyId: string): Promise<HubPackage[]> {
  return getSocietyPackageList(societyId, "deliveredpackages");
}

async function getSocietyPackageList(societyId: string, endpoint: string): Promise<HubPackage[]> {
  const response = await apiFetch(
    `${API}/societies/${encodeURIComponent(societyId)}/${endpoint}`,
    { headers: await authHeaders() },
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string; Message?: string };
    throw new Error(err.message ?? err.Message ?? `Failed to fetch packages (${response.status})`);
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map(toHubPackage);
}

export async function markPackageDelivered(
  packageId: string,
  request: DeliverPackageRequest,
): Promise<PackageStatusUpdateResponse> {
  const response = await apiFetch(`${API}/packages/${encodeURIComponent(packageId)}/deliver`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(request),
  });
  const result = (await response.json().catch(() => undefined)) as
    | boolean
    | { success?: boolean; Success?: boolean; succeeded?: boolean; Succeeded?: boolean; message?: string; Message?: string }
    | undefined;
  const body = typeof result === "object" && result !== null ? result : undefined;
  const message = body?.message ?? body?.Message;
  const succeeded = result === true || body?.success === true || body?.Success === true ||
    body?.succeeded === true || body?.Succeeded === true;
  if (!response.ok) throw new Error(message ?? `Package delivery update failed (${response.status})`);
  if (!succeeded) throw new Error(message ?? "Package delivery update failed.");
  return { success: true, packageId, message };
}

export interface GeneratePickupOtpResponse {
  pickupOtp: string;
  smsQueued: boolean;
  message?: string;
}

/** Generates and texts a replacement pickup OTP for one dispatched package. */
export async function generatePackagePickupOtp(
  packageId: string,
): Promise<GeneratePickupOtpResponse> {
  const response = await apiFetch(
    `${API}/packages/${encodeURIComponent(packageId)}/pickup-otp`,
    { method: "POST", headers: await authHeaders() },
  );
  const body = (await response.json().catch(() => ({}))) as {
    succeeded?: boolean;
    Succeeded?: boolean;
    pickupOtp?: string;
    PickupOtp?: string;
    message?: string;
    Message?: string;
    smsQueued?: boolean;
    SmsQueued?: boolean;
  };
  const message = body.message ?? body.Message;
  if (!response.ok || body.succeeded === false || body.Succeeded === false) {
    throw new Error(message ?? `Pickup OTP generation failed (${response.status})`);
  }
  const pickupOtp = body.pickupOtp ?? body.PickupOtp;
  if (!pickupOtp) throw new Error(message ?? "The server did not return a pickup OTP.");
  return {
    pickupOtp,
    smsQueued: body.smsQueued ?? body.SmsQueued ?? false,
    message,
  };
}

export async function dispatchPackage(
  packageId: string,
): Promise<PackageStatusUpdateResponse> {
  const response = await apiFetch(`${API}/packages/${encodeURIComponent(packageId)}/dispatch`, {
    method: "PUT",
    headers: await authHeaders(),
  });
  const result = (await response.json().catch(() => undefined)) as
    | boolean
    | {
        success?: boolean;
        Success?: boolean;
        succeeded?: boolean;
        Succeeded?: boolean;
        message?: string;
        Message?: string;
      }
    | undefined;
  const body = typeof result === "object" && result !== null ? result : undefined;
  const message = body?.message ?? body?.Message;
  const succeeded = result === true || body?.success === true || body?.Success === true ||
    body?.succeeded === true || body?.Succeeded === true;

  if (!response.ok) {
    throw new Error(message ?? `Package dispatch failed (${response.status})`);
  }
  if (!succeeded) {
    throw new Error(message ?? "Package dispatch failed.");
  }
  return { success: true, packageId, message };
}

/** Resident unavailable at door — return package to hub; shelf slot stays reserved. */
export async function reShelveAfterFailedDelivery(
  packageId: string,
): Promise<PackageStatusUpdateResponse> {
  const response = await apiFetch(
    `${API}/packages/${encodeURIComponent(packageId)}/re-shelve-failed-delivery`,
    {
      method: "POST",
      headers: await authHeaders(),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    succeeded?: boolean;
    Succeeded?: boolean;
    message?: string;
    Message?: string;
  };
  const message = body.message ?? body.Message;
  const succeeded = body.succeeded === true || body.Succeeded === true;
  if (!response.ok) {
    throw new Error(message ?? `Unable to return package to shelf (${response.status})`);
  }
  if (!succeeded) {
    throw new Error(message ?? "Unable to return package to shelf.");
  }
  return { success: true, packageId, message };
}

export interface MarkTowerFloorArrivalResponse {
  message: string;
  loggedCount: number;
  packageIds: string[];
}

/** Logs door-route arrival at tower (+ optional floor) for dispatched packages. */
export async function markTowerFloorArrival(
  societyId: string,
  towerWing: string,
  floor?: number | null,
): Promise<MarkTowerFloorArrivalResponse> {
  const response = await apiFetch(
    `${API}/societies/${encodeURIComponent(societyId)}/tower-route/arrived`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ towerWing, floor: floor ?? null }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    Message?: string;
    loggedCount?: number;
    LoggedCount?: number;
    packageIds?: string[];
    PackageIds?: string[];
  };
  const message = body.message ?? body.Message;
  if (!response.ok) {
    throw new Error(message ?? `Unable to mark tower/floor arrival (${response.status})`);
  }
  const packageIds = (body.packageIds ?? body.PackageIds ?? []).map(String);
  return {
    message: message ?? "Arrival logged.",
    loggedCount: body.loggedCount ?? body.LoggedCount ?? packageIds.length,
    packageIds,
  };
}

export async function startTowerRoute(
  societyId: string,
  towerWing: string,
  floor?: number | null,
): Promise<StartTowerRouteResponse> {
  const response = await apiFetch(
    `${API}/societies/${encodeURIComponent(societyId)}/tower-route/start`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ towerWing, floor: floor ?? null }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    Message?: string;
    dispatchedCount?: number;
    DispatchedCount?: number;
    packageIds?: string[];
    PackageIds?: string[];
  };
  const message = body.message ?? body.Message;
  if (!response.ok) {
    throw new Error(message ?? `Unable to start tower route (${response.status})`);
  }
  const packageIds = (body.packageIds ?? body.PackageIds ?? []).map(String);
  return {
    message: message ?? "Route started.",
    dispatchedCount: body.dispatchedCount ?? body.DispatchedCount ?? packageIds.length,
    packageIds,
  };
}
