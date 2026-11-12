import * as SQLite from "expo-sqlite";
import type { ConfirmIntakePayload, ConfirmIntakeResult } from "@/features/package-intake/services/intakeApi";
import type { QueuedIntakeRow } from "@/features/package-intake/models/packageIntake.types";
import { createClientId } from "@/shared/utils/createClientId";

const DB_NAME = "sph_staff_intake.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS intake_queue (
          id TEXT PRIMARY KEY NOT NULL,
          client_request_id TEXT NOT NULL UNIQUE,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          local_receipt_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_intake_queue_status_next
          ON intake_queue (status, next_attempt_at);
      `);
      return db;
    })();
  }
  return dbPromise;
}

function mapRow(row: Record<string, unknown>): QueuedIntakeRow {
  return {
    id: String(row.id),
    clientRequestId: String(row.client_request_id),
    payloadJson: String(row.payload_json),
    status: String(row.status) as QueuedIntakeRow["status"],
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: Number(row.next_attempt_at ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    localReceiptJson: (row.local_receipt_json as string | null) ?? null,
  };
}

export function buildLocalReceipt(
  payload: ConfirmIntakePayload,
): ConfirmIntakeResult {
  const unit = [payload.tower, payload.flatNumber].filter(Boolean).join("-");
  return {
    intakeId: "",
    packageId: "",
    pkgNumber: `LOCAL-${payload.awb.slice(0, 8).toUpperCase()}`,
    awb: payload.awb,
    courier: payload.courier ?? null,
    shelfCode: "",
    status: "QueuedOffline",
    isCod: payload.isCod,
    codAmount: payload.codAmount,
    codApprovalStatus: payload.isCod ? "Pending" : "None",
    pickupOtp: null,
    pickupQrPayload: "",
    notificationStatus: "Queued",
    matchStatus: payload.matchStatus,
    photoStored: false,
    resident: payload.recipientName
      ? {
          id: payload.residentId ?? "",
          name: payload.recipientName,
          tower: payload.tower,
          flatNumber: payload.flatNumber,
          isActive: true,
          unit: unit || payload.recipientName,
        }
      : null,
    queuedOffline: true,
  };
}

export async function enqueueIntake(
  payload: ConfirmIntakePayload,
): Promise<ConfirmIntakeResult> {
  const db = await getDb();
  const now = Date.now();
  const id = createClientId();
  const receipt = buildLocalReceipt(payload);
  await db.runAsync(
    `INSERT INTO intake_queue (
      id, client_request_id, payload_json, status, attempts, next_attempt_at,
      last_error, created_at, updated_at, local_receipt_json
    ) VALUES (?, ?, ?, 'pending', 0, ?, NULL, ?, ?, ?)`,
    id,
    payload.clientRequestId,
    JSON.stringify(payload),
    now,
    now,
    now,
    JSON.stringify(receipt),
  );
  return receipt;
}

export async function countPendingIntake(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM intake_queue WHERE status IN ('pending', 'failed', 'syncing')`,
  );
  return Number(row?.c ?? 0);
}

export async function listDueIntake(limit = 10): Promise<QueuedIntakeRow[]> {
  const db = await getDb();
  const now = Date.now();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM intake_queue
     WHERE status IN ('pending', 'failed')
       AND next_attempt_at <= ?
     ORDER BY created_at ASC
     LIMIT ?`,
    now,
    limit,
  );
  return rows.map(mapRow);
}

export async function markIntakeSyncing(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE intake_queue SET status = 'syncing', updated_at = ? WHERE id = ?`,
    Date.now(),
    id,
  );
}

export async function markIntakeSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE intake_queue SET status = 'synced', last_error = NULL, updated_at = ? WHERE id = ?`,
    Date.now(),
    id,
  );
}

/** Exponential backoff: 2s, 4s, 8s … capped at 15 minutes. */
export function nextBackoffMs(attempts: number): number {
  const base = 2000 * Math.pow(2, Math.max(0, attempts));
  return Math.min(base, 15 * 60 * 1000);
}

export async function markIntakeFailed(
  id: string,
  attempts: number,
  error: string,
): Promise<void> {
  const db = await getDb();
  const next = Date.now() + nextBackoffMs(attempts);
  await db.runAsync(
    `UPDATE intake_queue
     SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
    attempts,
    next,
    error.slice(0, 500),
    Date.now(),
    id,
  );
}

export async function purgeSyncedOlderThan(ms = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDb();
  const cutoff = Date.now() - ms;
  await db.runAsync(
    `DELETE FROM intake_queue WHERE status = 'synced' AND updated_at < ?`,
    cutoff,
  );
}
