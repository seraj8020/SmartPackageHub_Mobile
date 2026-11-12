import { API } from "@/shared/services/apiClient";
import { INTAKE_COURIERS } from "@/features/package-intake/constants";

/** Carrier names for intake dropdowns. Falls back to seed list on failure. */
export async function getCourierCarriers(societyId?: string | null): Promise<string[]> {
  try {
    const query = societyId ? `?societyId=${encodeURIComponent(societyId)}` : "";
    const response = await fetch(`${API}/couriers/carriers${query}`);
    if (!response.ok) return [...INTAKE_COURIERS];
    const rows = (await response.json()) as unknown[];
    const carriers = rows.map((item) => String(item)).filter((item) => item.trim().length > 0);
    return carriers.length > 0 ? carriers : [...INTAKE_COURIERS];
  } catch {
    return [...INTAKE_COURIERS];
  }
}
