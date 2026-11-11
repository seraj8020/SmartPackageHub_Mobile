import * as SecureStore from "expo-secure-store";
import type {
  ResidentSessionState,
  StaffSessionState,
} from "@/features/authentication/models/auth.types";

const RESIDENT_KEY = "SPH_resident_session";
const STAFF_KEY = "SPH_staff_session";

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getResidentSession(): Promise<ResidentSessionState | null> {
  const session = await readJson<ResidentSessionState>(RESIDENT_KEY);
  if (!session?.residentId || !session.societyId || !session.expiresAt || session.expiresAt <= Date.now()) {
    await SecureStore.deleteItemAsync(RESIDENT_KEY).catch(() => undefined);
    return null;
  }
  return session;
}

export async function setResidentSession(session: ResidentSessionState): Promise<void> {
  await SecureStore.setItemAsync(RESIDENT_KEY, JSON.stringify(session));
}

export async function clearResidentSession(): Promise<void> {
  await SecureStore.deleteItemAsync(RESIDENT_KEY).catch(() => undefined);
}

export async function getStaffSession(): Promise<StaffSessionState | null> {
  const session = await readJson<StaffSessionState>(STAFF_KEY);
  if (!session?.userId || !session.expiresAt || session.expiresAt <= Date.now()) {
    await SecureStore.deleteItemAsync(STAFF_KEY).catch(() => undefined);
    return null;
  }
  return session;
}

export async function setStaffSession(session: StaffSessionState): Promise<void> {
  await SecureStore.setItemAsync(STAFF_KEY, JSON.stringify(session));
}

export async function clearStaffSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STAFF_KEY).catch(() => undefined);
}
