import { useEffect, useMemo, useState } from "react";
import {
  bookDeliverySlot,
  getDeliverySlotAvailability,
} from "@/features/delivery-slots/services/deliverySlotApi";
import type {
  DeliverySlotAvailability,
  DeliverySlotWindow,
  PreferredDeliveryMethod,
} from "@/features/delivery-slots/models/deliverySlot.types";
import type { HubPackage } from "@/shared/services/packageApi";

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayTab(date: Date, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function useDoorDeliveryBooking(options: {
  pkg: HubPackage;
  residentId: string;
  societyId: string;
}) {
  const { residentId, societyId } = options;
  const selectedPackage = options.pkg;

  const dayOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [0, 1, 2].map((offset) => {
      const date = addDays(today, offset);
      return {
        date,
        dateOnly: toDateOnly(date),
        label: formatDayTab(date, offset),
      };
    });
  }, []);

  const [deliveryMethod, setDeliveryMethod] = useState<PreferredDeliveryMethod>(() =>
    selectedPackage.preferredDeliveryMethod === "CounterPickup"
      ? "CounterPickup"
      : "DoorDelivery",
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [availability, setAvailability] = useState<DeliverySlotAvailability | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<DeliverySlotWindow | null>(null);
  const [doorNote, setDoorNote] = useState("");
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (deliveryMethod !== "DoorDelivery") {
      setAvailability(null);
      setSelectedWindow(null);
      setLoadingAvailability(false);
      return;
    }

    if (!societyId) {
      setAvailability(null);
      setSelectedWindow(null);
      setLoadingAvailability(false);
      setError("Society session is missing. Sign in again.");
      return;
    }

    let mounted = true;
    const day = dayOptions[selectedDayIndex];
    if (!day) return;
    setLoadingAvailability(true);
    setError(null);
    getDeliverySlotAvailability(societyId, day.dateOnly)
      .then((data) => {
        if (!mounted) return;
        setAvailability(data);
        setSelectedWindow((current) => {
          const selectable = (window: DeliverySlotWindow) =>
            !window.isFull && !window.isDefaultWindow;
          if (!current) return data.windows.find(selectable) ?? null;
          const match = data.windows.find(
            (window) =>
              window.windowStart === current.windowStart &&
              window.windowEnd === current.windowEnd,
          );
          if (match && selectable(match)) return match;
          return data.windows.find(selectable) ?? null;
        });
      })
      .catch((err: unknown) => {
        if (mounted) {
          setAvailability(null);
          setSelectedWindow(null);
          setError(err instanceof Error ? err.message : "Unable to load slot availability.");
        }
      })
      .finally(() => {
        if (mounted) setLoadingAvailability(false);
      });
    return () => {
      mounted = false;
    };
  }, [dayOptions, selectedDayIndex, societyId, deliveryMethod]);

  async function submitBooking() {
    if (!residentId || !societyId) {
      setError("Resident session is missing. Sign in again.");
      return null;
    }
    if (deliveryMethod === "DoorDelivery" && !selectedWindow) {
      setError("Select a delivery window for door delivery.");
      return null;
    }
    setBooking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await bookDeliverySlot({
        societyId,
        residentId,
        packageId: selectedPackage.id,
        preferredDeliveryMethod: deliveryMethod,
        windowStart:
          deliveryMethod === "DoorDelivery" ? selectedWindow?.windowStart : undefined,
        windowEnd: deliveryMethod === "DoorDelivery" ? selectedWindow?.windowEnd : undefined,
        notes: deliveryMethod === "DoorDelivery" ? doorNote.trim() || undefined : undefined,
      });
      setSuccess(
        deliveryMethod === "DoorDelivery"
          ? `Door delivery booked for ${selectedWindow?.label}.`
          : "Counter pickup selected. Staff will keep the package at the hub.",
      );
      setDoorNote("");
      if (deliveryMethod === "DoorDelivery") {
        const day = dayOptions[selectedDayIndex];
        if (day) {
          const refreshed = await getDeliverySlotAvailability(societyId, day.dateOnly);
          setAvailability(refreshed);
        }
      }
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save delivery preference.");
      return null;
    } finally {
      setBooking(false);
    }
  }

  const canSubmit =
    deliveryMethod === "CounterPickup" ||
    (deliveryMethod === "DoorDelivery" &&
      Boolean(selectedWindow) &&
      !selectedWindow?.isFull &&
      !selectedWindow?.isDefaultWindow);

  return {
    selectedPackage,
    deliveryMethod,
    setDeliveryMethod,
    dayOptions,
    selectedDayIndex,
    setSelectedDayIndex,
    availability,
    selectedWindow,
    setSelectedWindow,
    doorNote,
    setDoorNote,
    loadingAvailability,
    booking,
    error,
    success,
    canSubmit,
    submitBooking,
  };
}
