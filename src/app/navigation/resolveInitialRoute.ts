import type { RootStackParamList } from "@/app/navigation/types";
import {
  getResidentSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";

/** Cold-start route from persisted session; Launch only when signed out / expired. */
export async function resolveInitialRoute(): Promise<
  keyof RootStackParamList
> {
  const token = await tokenStorage.getToken();
  if (!token) return "Launch";

  const staff = await getStaffSession();
  if (staff) return "StaffApp";

  const resident = await getResidentSession();
  if (resident) return "ResidentApp";

  await tokenStorage.removeToken();
  return "Launch";
}
