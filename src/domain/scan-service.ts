import type { FindingView, ScanJob, ScanSummary, ScanView } from "./entities";
import type {
  FindingRepository,
  ScanQueue,
  ScanRepository,
  TargetRepository,
  VulnerabilityScanner,
} from "./ports";

// The use-cases of the system. Depends only on ports — no pg, no fastify,
// no nuclei. Adapters are injected in the composition root (main.ts).
export class ScanService {
  constructor(
    private readonly targets: TargetRepository,
    private readonly scans: ScanRepository,
    private readonly findings: FindingRepository,
    private readonly queue: ScanQueue,
    private readonly scanner: VulnerabilityScanner,
  ) {}

  // Trigger a scan: record the target, create a queued scan, enqueue the job.
  async requestScan(targetSpec: string): Promise<number> {
    const target = await this.targets.upsert(targetSpec);
    const scan = await this.scans.create(target.id);
    await this.queue.enqueue({ scanId: scan.id, targetSpec });
    return scan.id;
  }

  // Run a queued scan to completion. Never throws: failures are recorded so a
  // broken scan is distinguishable from one that simply found nothing.
  async processScan(job: ScanJob): Promise<void> {
    await this.scans.setStatus(job.scanId, "running");
    try {
      const found = await this.scanner.scan(job.targetSpec);
      await this.findings.addMany(job.scanId, found);
      await this.scans.setStatus(job.scanId, "succeeded");
    } catch (e) {
      await this.scans.setStatus(job.scanId, "failed", (e as Error).message);
    }
  }

  listScans(): Promise<ScanSummary[]> {
    return this.scans.listSummaries();
  }

  async getScan(id: number): Promise<(ScanView & { findings: FindingView[] }) | null> {
    const view = await this.scans.findView(id);
    if (!view) return null;
    const findings = await this.findings.listByScan(id);
    return { ...view, findings };
  }
}
