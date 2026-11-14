import type { ShelfInventoryItem } from "@/features/shelf-management/models/shelfInventory.types";

export const DEFAULT_SHELF_CAPACITY = 40;

export type ShelfPickerOption = {
  id: string;
  code: string;
  row: string;
  towerOrWing?: string;
  capacity: number;
  packageCount: number;
  remaining: number;
  isFull: boolean;
  isColdStorage: boolean;
};

export function effectiveCapacity(capacity: number | null | undefined): number {
  return capacity && capacity > 0 ? capacity : DEFAULT_SHELF_CAPACITY;
}

export function remainingSlots(capacity: number, packageCount: number): number {
  return Math.max(0, effectiveCapacity(capacity) - Math.max(0, packageCount));
}

export function rowFromShelfCode(code: string): string {
  const upper = code.trim().toUpperCase();
  const letter =
    upper.match(/^([A-Z])\s*-/)?.[1] ??
    upper.split("-").find((part) => /^[A-Z]$/.test(part)) ??
    upper.charAt(0);
  return /^[A-Z]$/.test(letter) ? letter : "A";
}

export function toShelfPickerOption(shelf: ShelfInventoryItem): ShelfPickerOption {
  const capacity = effectiveCapacity(shelf.capacity);
  const packageCount = Math.max(0, shelf.packageCount);
  const remaining = remainingSlots(capacity, packageCount);
  return {
    id: shelf.id,
    code: shelf.code,
    row: rowFromShelfCode(shelf.code),
    towerOrWing: shelf.towerOrWing,
    capacity,
    packageCount,
    remaining,
    isFull: shelf.isFull || remaining <= 0,
    isColdStorage: shelf.isColdStorage,
  };
}

export function applyOptimisticAssign(
  options: ShelfPickerOption[],
  shelfCode: string,
): ShelfPickerOption[] {
  return options.map((shelf) => {
    if (shelf.code.toLowerCase() !== shelfCode.trim().toLowerCase()) return shelf;
    const packageCount = shelf.packageCount + 1;
    const remaining = remainingSlots(shelf.capacity, packageCount);
    return {
      ...shelf,
      packageCount,
      remaining,
      isFull: remaining <= 0,
    };
  });
}
