export type PackageReturnReason =
  | "NotAsExpected"
  | "DamagedInside"
  | "Expired"
  | "TechnicalFault"
  | "Other";

export type RequestPackageReturnRequest = {
  residentId: string;
  reason: PackageReturnReason;
  note?: string;
};

export type RequestPackageReturnResponse = {
  id?: string;
  packageId?: string;
  status?: string;
  message?: string;
};

export type ReturnEligibilityInput = {
  status?: string | null;
  packageStatus?: string | null;
  returnStatus?: string | null;
  deliveredAt?: string | null;
  windowDays?: number;
  /** When true, blank status counts as Delivered (history list). */
  treatBlankAsDelivered?: boolean;
};

export type ReturnEligibility = {
  canRequest: boolean;
  alreadyRequested: boolean;
  isDelivered: boolean;
  withinWindow: boolean;
  /** Resident-facing status line (always set). */
  message: string;
};
