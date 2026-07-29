import type PgBoss from "pg-boss";
import type { ScanJob } from "../../domain/entities";
import type { ScanQueue } from "../../domain/ports";

export const SCAN_QUEUE = "scan";

export class PgBossScanQueue implements ScanQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueue(job: ScanJob): Promise<void> {
    await this.boss.send(SCAN_QUEUE, job);
  }

  async onScan(handler: (job: ScanJob) => Promise<void>): Promise<void> {
    await this.boss.work(SCAN_QUEUE, async (jobs: any) => {
      // pg-boss v10 hands the handler an array; tolerate a single job too.
      const list = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of list) await handler(job.data as ScanJob);
    });
  }
}
