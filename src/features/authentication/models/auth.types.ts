export interface ResidentLoginSession {
  token: string;
  residentId: string;
  societyId: string;
  fullName?: string;
  phoneNumber?: string;
  towerWing?: string;
  flatNumber?: string;
}

export interface ResidentSessionState {
  residentId: string;
  societyId: string;
  fullName?: string;
  phoneNumber?: string;
  towerWing?: string;
  flatNumber?: string;
  expiresAt: number;
}

export interface StaffLoginSession {
  token: string;
  userId: string;
  username: string;
  role: string;
  societyIds: string[];
  primarySocietyId: string | null;
}

export interface StaffSessionState {
  userId: string;
  username: string;
  role: string;
  societyIds: string[];
  primarySocietyId: string | null;
  expiresAt: number;
}

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
