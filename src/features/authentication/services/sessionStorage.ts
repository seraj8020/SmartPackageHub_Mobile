import * as SecureStore from "expo-secure-store";
import type {
  ResidentSessionState,
  StaffSessionState,
} from "@/features/authentication/models/auth.types";

const RESIDENT_KEY = "SPH_resident_session";
const STAFF_KEY = "SPH_staff_session";

/** In-memory session cache — SecureStore on every tap made return/home feel slow. */
let memoryResident: ResidentSessionState | null | undefined;
let memoryStaff: StaffSessionState | null | undefined;
let pendingResident: Promise<ResidentSessionState | null> | null = null;
let pendingStaff: Promise<StaffSessionState | null> | null = null;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isResidentValid(session: ResidentSessionState | null | undefined): session is ResidentSessionState {
  return Boolean(
    session?.residentId &&
      session.societyId &&
      session.expiresAt &&
      session.expiresAt > Date.now(),
  );
}

function isStaffValid(session: StaffSessionState | null | undefined): session is StaffSessionState {
  return Boolean(session?.userId && session.expiresAt && session.expiresAt > Date.now());
}

export async function getResidentSession(): Promise<ResidentSessionState | null> {
  if (memoryResident !== undefined) {
    if (isResidentValid(memoryResident)) return memoryResident;
    memoryResident = null;
    await SecureStore.deleteItemAsync(RESIDENT_KEY).catch(() => undefined);
    return null;
  }
  if (pendingResident) return pendingResident;
  pendingResident = (async () => {
    try {
      const session = await readJson<ResidentSessionState>(RESIDENT_KEY);
      if (!isResidentValid(session)) {
        memoryResident = null;
        await SecureStore.deleteItemAsync(RESIDENT_KEY).catch(() => undefined);
        return null;
      }
      memoryResident = session;
      return session;
    } finally {
      pendingResident = null;
    }
  })();
  return pendingResident;
}

export async function setResidentSession(session: ResidentSessionState): Promise<void> {
  memoryResident = session;
  await SecureStore.setItemAsync(RESIDENT_KEY, JSON.stringify(session));
}

export async function clearResidentSession(): Promise<void> {
  memoryResident = null;
  await SecureStore.deleteItemAsync(RESIDENT_KEY).catch(() => undefined);
}

export async function getStaffSession(): Promise<StaffSessionState | null> {
  if (memoryStaff !== undefined) {
    if (isStaffValid(memoryStaff)) return memoryStaff;
    memoryStaff = null;
    await SecureStore.deleteItemAsync(STAFF_KEY).catch(() => undefined);
    return null;
  }
  if (pendingStaff) return pendingStaff;
  pendingStaff = (async () => {
    try {
      const session = await readJson<StaffSessionState>(STAFF_KEY);
      if (!isStaffValid(session)) {
        memoryStaff = null;
        await SecureStore.deleteItemAsync(STAFF_KEY).catch(() => undefined);
        return null;
      }
      memoryStaff = session;
      return session;
    } finally {
      pendingStaff = null;
    }
  })();
  return pendingStaff;
}

export async function setStaffSession(session: StaffSessionState): Promise<void> {
  memoryStaff = session;
  await SecureStore.setItemAsync(STAFF_KEY, JSON.stringify(session));
}

export async function clearStaffSession(): Promise<void> {
  memoryStaff = null;
  await SecureStore.deleteItemAsync(STAFF_KEY).catch(() => undefined);
}

/** Drop memory caches (e.g. after forced re-auth). SecureStore clears happen via clear*Session. */
export function clearSessionMemoryCache(): void {
  memoryResident = undefined;
  memoryStaff = undefined;
}
