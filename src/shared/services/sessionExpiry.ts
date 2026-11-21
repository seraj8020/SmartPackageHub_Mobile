import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "@/app/navigation/navigationRef";
import {
  clearResidentSession,
  clearStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";

let handlingUnauthorized = false;

/**
 * Clears local auth and returns the user to the launch/login flow.
 * Used when the API reports an expired/missing staff or resident session (401).
 */
export async function forceReauthentication(reason = "Session expired. Please sign in again."): Promise<void> {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  try {
    await Promise.all([
      clearStaffSession(),
      clearResidentSession(),
      tokenStorage.removeToken(),
    ]);
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Launch", params: undefined }],
        }),
      );
    }
  } finally {
    // Allow a later 401 (after the user signs in again) to re-trigger.
    setTimeout(() => {
      handlingUnauthorized = false;
    }, 1500);
  }
  // Keep reason available for debugging; screens should not keep showing API 401 banners.
  if (__DEV__) {
    console.warn(`[sessionExpiry] ${reason}`);
  }
}

/** Returns true when the response indicates the caller must sign in again. */
export function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}
