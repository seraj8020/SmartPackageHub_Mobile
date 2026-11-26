import type { SupportFaqItem, SupportTopic } from "@/features/resident-support/models/support.types";

/** Traizr-style: ask from inside the app about the moment you are stuck. */
export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "missing_package",
    label: "Missing package",
    hint: "Courier says delivered but it is not in My packages",
  },
  {
    id: "pickup_otp",
    label: "Pickup OTP / handover",
    hint: "Code not received, expired, or staff cannot verify",
  },
  {
    id: "return_help",
    label: "Return request",
    hint: "Need help returning a delivered package",
  },
  {
    id: "vacation_hold",
    label: "Vacation hold",
    hint: "Hold dates, door delivery pause, or collector pickup",
  },
  {
    id: "account",
    label: "Account / flat details",
    hint: "Wrong tower, flat, name, or phone on your profile",
  },
  {
    id: "other",
    label: "Something else",
    hint: "Describe what you need help with",
  },
];

export const SUPPORT_FAQS: SupportFaqItem[] = [
  {
    id: "where-package",
    question: "Where is my package?",
    answer:
      "Open My packages for items still at the hub. After collection, they move to History. If a courier shows delivered but nothing appears here, ask Support with the AWB.",
  },
  {
    id: "otp",
    question: "I did not get a pickup OTP",
    answer:
      "OTP is sent when the package is ready for handover. Check SMS for the number on your account. Staff can also generate a fresh code from the handover screen.",
  },
  {
    id: "who-answers",
    question: "Who answers Support?",
    answer:
      "Your society hub team. Your message includes society, flat, and topic so they do not need three messages of setup context.",
  },
  {
    id: "return-window",
    question: "Can I return a package?",
    answer:
      "Delivered packages can be returned within the society return window (usually 7 days). Use History or package detail when Request return is available.",
  },
];

/** Fallback when API config / society email is unavailable. Override via ResidentSupport:SupportEmail. */
export const SPH_SUPPORT_EMAIL = "hello@byonverse.com";
