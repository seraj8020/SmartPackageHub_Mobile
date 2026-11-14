export interface ShelfPackage {
  id: string;
  residentName: string;
  packageNumber: string;
  courier: string;
  receivedAt: string;
}

export interface ShelfInventoryItem {
  id: string;
  code: string;
  towerOrWing?: string;
  capacity: number;
  packageCount: number;
  isFull: boolean;
  isColdStorage: boolean;
  packages: ShelfPackage[];
}
