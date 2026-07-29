// Pure domain types. This file imports nothing — the centre of the hexagon.

export type ScanStatus = "queued" | "running" | "succeeded" | "failed";

export interface Target {
  id: number;
  spec: string;
  verificationStatus: string;
}

// Emitted by a scanner; not yet persisted (no id / scanId).
export interface RawFinding {
  templateId: string;
  severity: string | null;
  matchedAt: string | null;
  raw?: unknown;
}

export interface FindingView {
  templateId: string;
  severity: string | null;
  matchedAt: string | null;
}

export interface ScanSummary {
  id: number;
  status: ScanStatus;
  target: string;
  createdAt: Date;
}

export interface ScanView {
  id: number;
  status: ScanStatus;
  failureReason: string | null;
  target: string;
  createdAt: Date;
  updatedAt: Date;
}

// A unit of work handed to the queue and picked up by the worker.
export interface ScanJob {
  scanId: number;
  targetSpec: string;
}
