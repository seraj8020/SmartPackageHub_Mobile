import * as Crypto from "expo-crypto";

export function createClientId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `sph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
