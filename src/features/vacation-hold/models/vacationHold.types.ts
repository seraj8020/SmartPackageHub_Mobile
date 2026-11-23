export type VacationHold = {
  id: string;
  societyId: string;
  residentId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  towerWing?: string;
  flatNumber?: string;
};

export type SaveVacationHoldRequest = {
  societyId: string;
  startDate: string;
  endDate: string;
};
