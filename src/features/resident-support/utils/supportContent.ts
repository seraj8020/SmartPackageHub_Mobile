import type { SupportCategory, SupportUrgency } from "@/features/resident-support/models/support.types";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { id: "missing_package", label: "Missing package" },
  { id: "pickup_otp", label: "Pickup OTP / handover" },
  { id: "return_help", label: "Return request" },
  { id: "vacation_hold", label: "Vacation hold" },
  { id: "account", label: "Account / flat details" },
  { id: "other", label: "Other" },
];

export const SUPPORT_URGENCIES: SupportUrgency[] = ["Low", "Normal", "High"];

/** Fallback when API config is unavailable. Override via ResidentSupport:SupportEmail. */
export const SPH_SUPPORT_EMAIL = "hello@byonverse.com";
