import type {
  ReturnEligibility,
  ReturnEligibilityInput,
} from "@/features/package-returns/models/packageReturn.types";

/** Default when society/carrier policy is unknown (matches API DefaultReturnWindowDays). */
export const DEFAULT_RETURN_WINDOW_DAYS = 7;

function normalizeStatus(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[_\s-]/g, "");
}

export function isReturnRequestedStatus(...statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => normalizeStatus(status) === "returnrequested");
}

export function isDeliveredLifecycleStatus(status?: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "delivered" || normalized === "completed";
}

/**
 * Eligibility for resident "Request return".
 * History: pass fromDeliveryHistory — rows are completed deliveries.
 * Package detail: pass explicit package lifecycle status.
 */
export function getReturnRequestEligibility(options: ReturnEligibilityInput): ReturnEligibility {
  const windowDays = options.windowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
  const alreadyRequested = isReturnRequestedStatus(
    options.returnStatus,
    options.packageStatus,
    options.status,
  );

  const lifecycle = normalizeStatus(options.packageStatus ?? options.status);
  const isDelivered =
    options.fromDeliveryHistory === true ||
    lifecycle === "delivered" ||
    lifecycle === "completed" ||
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
