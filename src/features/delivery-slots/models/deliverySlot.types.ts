export interface DeliverySlotWindow {
  windowStart: string;
  windowEnd: string;
  label: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
  isFull: boolean;
  /** System 6–9 fallback already set at shelving — not selectable by residents. */
  isDefaultWindow?: boolean;
}

export interface DeliverySlotAvailability {
  date: string;
  windows: DeliverySlotWindow[];
}

export type PreferredDeliveryMethod = "DoorDelivery" | "CounterPickup";

export interface BookDeliverySlotRequest {
  societyId: string;
  residentId: string;
  packageId: string;
  windowStart?: string;
  windowEnd?: string;
  notes?: string;
  preferredDeliveryMethod: PreferredDeliveryMethod;
}

export interface DeliverySlotBooking {
  id: string;
  societyId: string;
  residentId: string;
  packageId: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  notes: string;
  pkgNumber?: string;
  courier?: string;
}
