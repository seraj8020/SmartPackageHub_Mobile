import NetInfo from "@react-native-community/netinfo";
import {
  batchConfirmIntake,
  confirmIntake,
  type ConfirmIntakePayload,
} from "@/features/package-intake/services/intakeApi";
import {
  countPendingIntake,
  listDueIntake,
  markIntakeFailed,
  markIntakeSynced,
  markIntakeSyncing,
  purgeSyncedOlderThan,
} from "@/features/package-intake/services/intakeQueueDb";

type SyncListener = (pendingCount: number) => void;

let flushing = false;
let started = false;
let netUnsub: (() => void) | null = null;
const listeners = new Set<SyncListener>();

async function notify(): Promise<void> {
  const count = await countPendingIntake();
  listeners.forEach((listener) => listener(count));
}

export function subscribeIntakeQueue(listener: SyncListener): () => void {
  listeners.add(listener);
  void countPendingIntake().then(listener).catch(() => listener(0));
  return () => {
    listeners.delete(listener);
  };
}

export async function flushIntakeQueue(): Promise<void> {
  if (flushing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    await notify();
    return;
  }

  flushing = true;
  try {
    await purgeSyncedOlderThan();
    const due = await listDueIntake(20);
    if (due.length === 0) return;

    for (const row of due) {
      await markIntakeSyncing(row.id);
    }

    const payloads = due.map((row) => ({
      id: row.id,
      attempts: row.attempts,
      payload: JSON.parse(row.payloadJson) as ConfirmIntakePayload,
    }));

    try {
      const batch = await batchConfirmIntake(payloads.map((item) => item.payload));
      const byClientId = new Map(
        batch.results.map((result) => [result.clientRequestId ?? "", result]),
      );

      for (const item of payloads) {
        const result =
          byClientId.get(item.payload.clientRequestId) ??
          batch.results.find(
            (row) =>
              (row.awb ?? "").toUpperCase() === item.payload.awb.trim().toUpperCase(),
          );

        if (result?.succeeded) {
          await markIntakeSynced(item.id);
          continue;
        }

        // Permanent client errors (validation / not found) — still backoff so staff can fix later.
        const message = result?.error ?? `Batch item failed (${result?.statusCode ?? 0})`;
        await markIntakeFailed(item.id, item.attempts + 1, message);
      }
    } catch {
      // Batch endpoint unavailable / network flake → fall back to single confirms.
      for (const item of payloads) {
        try {
          await confirmIntake(item.payload);
          await markIntakeSynced(item.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Sync failed";
          await markIntakeFailed(item.id, item.attempts + 1, message);
        }
      }
    }
  } finally {
    flushing = false;
    await notify();
  }
}

export function startIntakeQueueSync(): void {
  if (started) return;
  started = true;

  netUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void flushIntakeQueue();
    }
  });

  void flushIntakeQueue();
  // Periodic sweep so backoff windows eventually fire while app is open.
  setInterval(() => {
    void flushIntakeQueue();
  }, 30_000);
}

export function stopIntakeQueueSync(): void {
  netUnsub?.();
  netUnsub = null;
  started = false;
}
