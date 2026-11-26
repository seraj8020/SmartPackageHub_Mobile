export type SupportTopicId =
  | "missing_package"
  | "pickup_otp"
  | "return_help"
  | "vacation_hold"
  | "account"
  | "other";

export type SupportTopic = {
  id: SupportTopicId;
  label: string;
  hint: string;
};

export type SupportFaqItem = {
  id: string;
  question: string;
  answer: string;
};

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
  topicId: SupportTopicId;
  topicLabel: string;
  message: string;
};
