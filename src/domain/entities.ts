// Pure domain types. This file imports nothing — the centre of the hexagon.

export type ScanStatus = "queued" | "running" | "succeeded" | "failed";

// A Scan Profile controls a scan's scope/speed. Built-in presets only for now
// (see CONTEXT.md). SCAN_PROFILES is the single source of truth for validation;
// the profile -> tool-flag mapping lives in the scanner adapter, not here.
export const SCAN_PROFILES = ["quick", "standard", "full"] as const;
export type ScanProfile = (typeof SCAN_PROFILES)[number];
export const DEFAULT_SCAN_PROFILE: ScanProfile = "standard";

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
  profile: ScanProfile;
  target: string;
  createdAt: Date;
}

export interface ScanView {
  id: number;
  status: ScanStatus;
  profile: ScanProfile;
  failureReason: string | null;
  target: string;
  createdAt: Date;
  updatedAt: Date;
}

// A unit of work handed to the queue and picked up by the worker.
export interface ScanJob {
  scanId: number;
  targetSpec: string;
  profile: ScanProfile;
}
