import type { ScanQueue } from "../../domain/ports";
import type { ScanService } from "../../domain/scan-service";

// Delivery adapter: routes queued jobs into the ScanService. The mirror of the
// HTTP adapter — a different way to trigger the same use-case.
export function registerScanWorker(queue: ScanQueue, scanService: ScanService): Promise<void> {
  return queue.onScan((job) => scanService.processScan(job));
}
