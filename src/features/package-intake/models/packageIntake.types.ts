import type { ResidentMatch } from "@/features/package-intake/services/intakeApi";

export type MatchView =
  | { status: "idle" | "loading" | "missing" }
  | { status: "matched"; resident: ResidentMatch }
  | { status: "ambiguous"; residents: ResidentMatch[] }
  | { status: "error"; message: string };

export type IntakeQueueStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuedIntakeRow {
  id: string;
  clientRequestId: string;
  payloadJson: string;
  status: IntakeQueueStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  localReceiptJson: string | null;
}
