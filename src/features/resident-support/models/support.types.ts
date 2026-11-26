export type SupportCategoryId =
  | "missing_package"
  | "pickup_otp"
  | "return_help"
  | "vacation_hold"
  | "account"
  | "other";

export type SupportUrgency = "Low" | "Normal" | "High";

export type SupportCategory = {
  id: SupportCategoryId;
  label: string;
};

export type SupportTicket = {
  id: string;
  referenceCode: string;
  subject: string;
  category: string;
  urgency: string;
  message: string;
  status: string;
  supportEmail?: string;
  requestedAtUtc: string;
};

/** @deprecated kept for older helpers */
export type SupportTopicId = SupportCategoryId;
export type SupportTopic = SupportCategory & { hint?: string };
export type SupportFaqItem = { id: string; question: string; answer: string };
export type SupportContext = {
  residentName: string;
  residentId: string;
  phoneNumber?: string;
  societyId: string;
  societyName: string;
  societyEmail?: string;
  societyPhone?: string;
  towerWing?: string;
  flatNumber?: string;
  topicId: SupportCategoryId;
  topicLabel: string;
  message: string;
};
