/** Default when society/carrier policy is unknown (matches API DefaultReturnWindowDays). */
export const DEFAULT_RETURN_WINDOW_DAYS = 7;

export type ReturnEligibility = {
  canRequest: boolean;
  alreadyRequested: boolean;
  isDelivered: boolean;
  withinWindow: boolean;
  /** Resident-facing status line (always set). */
  message: string;
};

function normalizeStatus(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[_\s-]/g, "");
}

export function isReturnRequestedStatus(...statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => normalizeStatus(status) === "returnrequested");
}

/**
 * History rows often omit packageStatus when the item is a completed delivery.
 * Treat blank lifecycle as Delivered for history; package detail should pass explicit status.
 */
export function getReturnRequestEligibility(options: {
  status?: string | null;
  packageStatus?: string | null;
  returnStatus?: string | null;
  deliveredAt?: string | null;
  windowDays?: number;
  /** When true, blank status counts as Delivered (history list). */
  treatBlankAsDelivered?: boolean;
}): ReturnEligibility {
  const windowDays = options.windowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
  const alreadyRequested = isReturnRequestedStatus(
    options.returnStatus,
    options.packageStatus,
    options.status,
  );
  const lifecycle = normalizeStatus(options.packageStatus ?? options.status);
  const isDelivered =
    lifecycle === "delivered" ||
    (options.treatBlankAsDelivered === true && lifecycle === "");

  const deliveredAtMs = Date.parse(options.deliveredAt ?? "");
  const hasDeliveredAt = Number.isFinite(deliveredAtMs);
  const withinWindow =
    hasDeliveredAt && Date.now() <= deliveredAtMs + windowDays * 24 * 60 * 60 * 1000;

  if (alreadyRequested) {
    return {
      canRequest: false,
      alreadyRequested: true,
      isDelivered,
      withinWindow,
      message: "Return already requested",
    };
  }

  if (!isDelivered) {
    return {
      canRequest: false,
      alreadyRequested: false,
      isDelivered: false,
      withinWindow: false,
      message: "Request return is only available for delivered packages",
    };
  }

  if (!hasDeliveredAt) {
    return {
      canRequest: false,
      alreadyRequested: false,
      isDelivered: true,
      withinWindow: false,
      message: "Delivery date unavailable — return cannot be requested yet",
    };
  }

  if (!withinWindow) {
    return {
      canRequest: false,
      alreadyRequested: false,
      isDelivered: true,
      withinWindow: false,
      message: `Return window of ${windowDays} day(s) has closed`,
    };
  }

  return {
    canRequest: true,
    alreadyRequested: false,
    isDelivered: true,
    withinWindow: true,
    message: `Within ${windowDays}-day return window`,
  };
}
