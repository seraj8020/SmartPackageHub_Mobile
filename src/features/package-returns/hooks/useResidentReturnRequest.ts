import { useCallback, useMemo, useState } from "react";
import { getResidentSession } from "@/features/authentication/services/sessionStorage";
import type { PackageReturnReason } from "@/features/package-returns/models/packageReturn.types";
import { requestPackageReturn } from "@/features/package-returns/services/packageReturnApi";
import { getReturnRequestEligibility } from "@/features/package-returns/utils/residentReturnEligibility";

type Options = {
  packageId: string;
  status?: string | null;
  packageStatus?: string | null;
  returnStatus?: string | null;
  deliveredAt?: string | null;
  treatBlankAsDelivered?: boolean;
  reason?: PackageReturnReason;
  onSucceeded?: () => void;
};

export function useResidentReturnRequest({
  packageId,
  status,
  packageStatus,
  returnStatus,
  deliveredAt,
  treatBlankAsDelivered,
  reason = "DamagedInside",
  onSucceeded,
}: Options) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const effectiveStatus = localStatus ?? status;
  const effectiveReturnStatus = submitted ? "ReturnRequested" : returnStatus;

  const eligibility = useMemo(
    () =>
      getReturnRequestEligibility({
        status: effectiveStatus,
        packageStatus,
        returnStatus: effectiveReturnStatus,
        deliveredAt,
        treatBlankAsDelivered,
      }),
    [deliveredAt, effectiveReturnStatus, effectiveStatus, packageStatus, treatBlankAsDelivered],
  );

  const submit = useCallback(async () => {
    if (busy || !eligibility.canRequest || !packageId) return;
    setBusy(true);
    setError(null);
    try {
      const session = await getResidentSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      await requestPackageReturn(packageId, session.residentId, reason);
      setLocalStatus("ReturnRequested");
      setSubmitted(true);
      onSucceeded?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request return.");
    } finally {
      setBusy(false);
    }
  }, [busy, eligibility.canRequest, onSucceeded, packageId, reason]);

  return {
    eligibility,
    busy,
    error,
    submitted,
    status: effectiveStatus,
    submit,
  };
}
