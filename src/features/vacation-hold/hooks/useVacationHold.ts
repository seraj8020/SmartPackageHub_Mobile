import { useCallback, useEffect, useMemo, useState } from "react";
import type { VacationHold } from "@/features/vacation-hold/models/vacationHold.types";
import { cancelVacationHold, getVacationHold, saveVacationHold } from "@/features/vacation-hold/services/vacationHoldApi";
import { toApiDate, toDateOnly, validateHoldDates } from "@/features/vacation-hold/utils/vacationHoldDates";

export function useVacationHold(residentId: string, societyId: string, fallbackTower?: string, fallbackFlat?: string) {
  const [hold, setHold] = useState<VacationHold | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residentId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getVacationHold(residentId);
      setHold(next);
      setStartDate(toDateOnly(next?.startDate));
      setEndDate(toDateOnly(next?.endDate));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load vacation hold.");
    } finally {
      setLoading(false);
    }
  }, [residentId]);

  useEffect(() => void load(), [load]);

  const unitLabel = useMemo(() => {
    const tower = hold?.towerWing ?? fallbackTower;
    const flat = hold?.flatNumber ?? fallbackFlat;
    return [tower ? `Tower ${tower}` : "", flat ? `Flat ${flat}` : ""].filter(Boolean).join(" · ") || "Your flat";
  }, [fallbackFlat, fallbackTower, hold?.flatNumber, hold?.towerWing]);

  const save = useCallback(async () => {
    const validation = validateHoldDates(startDate.trim(), endDate.trim());
    if (validation) {
      setError(validation);
      return;
    }
    if (!societyId) {
      setError("Society is missing from your session. Sign in again.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveVacationHold(residentId, { societyId, startDate: toApiDate(startDate.trim()), endDate: toApiDate(endDate.trim()) });
      setMessage("Vacation hold saved. Packages will stay at the hub during these dates.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save vacation hold.");
    } finally {
      setBusy(false);
    }
  }, [endDate, load, residentId, societyId, startDate]);

  const cancel = useCallback(async () => {
    if (!hold?.isActive) {
      setError("Only an active vacation hold can be cancelled.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await cancelVacationHold(residentId);
      setMessage("Vacation hold cancelled. Door delivery can be booked again.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel vacation hold.");
    } finally {
      setBusy(false);
    }
  }, [hold?.isActive, load, residentId]);

  return { hold, startDate, endDate, setStartDate, setEndDate, loading, busy, error, message, unitLabel, save, cancel };
}
