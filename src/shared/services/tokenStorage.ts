import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "SPH_token";

/** In-memory cache so inbox cards / API calls do not hit SecureStore N times. */
let memoryToken: string | null | undefined;
/** Coalesce concurrent first reads before the memory cache is warm. */
let pendingRead: Promise<string | null> | null = null;

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    if (memoryToken !== undefined) return memoryToken;
    if (pendingRead) return pendingRead;
    pendingRead = (async () => {
      try {
        memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
        return memoryToken;
      } catch {
        memoryToken = null;
        return null;
      } finally {
        pendingRead = null;
      }
    })();
    return pendingRead;
  },

  async setToken(token: string): Promise<void> {
    memoryToken = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async removeToken(): Promise<void> {
    memoryToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  clearMemoryCache(): void {
    memoryToken = undefined;
  },
};
