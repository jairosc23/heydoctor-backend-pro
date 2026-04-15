import type { LoggerService } from '@nestjs/common';
import type { Queue } from 'bullmq';

function parseDrainMs(): number {
  const raw = process.env.QUEUE_PAUSE_ACTIVE_DRAIN_MS?.trim();
  if (!raw) return 120_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : 120_000;
}

/**
 * Pausa colas BullMQ y espera a que los jobs `active` terminen (o timeout).
 * Tras `pause()`, no entran nuevos jobs desde waiting; los activos siguen hasta completar.
 */
export async function pauseQueuesAndWaitForActive(
  queues: Queue[],
  log: LoggerService,
  context: string,
): Promise<void> {
  if (queues.length === 0) {
    return;
  }
  await Promise.all(queues.map((q) => q.pause()));
  const maxMs = parseDrainMs();
  const step = 400;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const counts = await Promise.all(
      queues.map((q) => q.getJobCountByTypes('active')),
    );
    if (counts.every((c) => c === 0)) {
      log.log(
        JSON.stringify({
          msg: 'queue_pause_active_drained',
          context,
          queues: queues.map((q) => q.name),
        }),
      );
      return;
    }
    await new Promise((r) => setTimeout(r, step));
  }
  const finalCounts = await Promise.all(
    queues.map((q) => q.getJobCountByTypes('active')),
  );
  log.warn(
    JSON.stringify({
      msg: 'queue_pause_active_drain_timeout',
      context,
      activeByQueue: queues.map((q, i) => ({
        name: q.name,
        active: finalCounts[i],
      })),
    }),
  );
}
