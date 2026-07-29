// Ports: the interfaces the domain depends on. Adapters implement these.
// The domain never imports an adapter — only these contracts.
import type {
  FindingView,
  RawFinding,
  ScanJob,
  ScanProfile,
  ScanStatus,
  ScanSummary,
  ScanView,
  Target,
} from "./entities";

export interface TargetRepository {
  // Record a target (own assets auto-verified for now), returning it.
  upsert(spec: string): Promise<Target>;
}

export interface ScanRepository {
  create(targetId: number, profile: ScanProfile): Promise<{ id: number }>;
  setStatus(id: number, status: ScanStatus, failureReason?: string | null): Promise<void>;
  findView(id: number): Promise<ScanView | null>;
  listSummaries(): Promise<ScanSummary[]>;
}

export interface FindingRepository {
  addMany(scanId: number, findings: RawFinding[]): Promise<void>;
  listByScan(scanId: number): Promise<FindingView[]>;
}

export interface ScanQueue {
  enqueue(job: ScanJob): Promise<void>;
  onScan(handler: (job: ScanJob) => Promise<void>): Promise<void>;
}

export interface VulnerabilityScanner {
  // The seam the Rust worker will reimplement later, behind this same contract.
  // The profile is a domain concept; the adapter maps it to its own tool flags.
  scan(targetSpec: string, profile: ScanProfile): Promise<RawFinding[]>;
}
