// Client-side mirror of the API contract. Kept small and hand-written rather
// than sharing types across the process boundary — the API is the contract.

export type ScanProfile = "quick" | "standard" | "full";
export const SCAN_PROFILES: ScanProfile[] = ["quick", "standard", "full"];

// Single source of truth for the severity set on the client side too.
export const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "info"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];
export type SeverityCounts = Record<SeverityLevel, number>;

export interface ScanSummary {
  id: number;
  status: string;
  profile: ScanProfile;
  target: string;
  severityCounts: SeverityCounts;
  createdAt: string;
}

export interface Finding {
  templateId: string;
  severity: string | null;
  matchedAt: string | null;
}

export interface ScanDetail {
  id: number;
  status: string;
  profile: ScanProfile;
  target: string;
  failureReason: string | null;
  findings: Finding[];
}

// Reject non-2xx before parsing, so an error body never masquerades as data.
async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function listScans(): Promise<ScanSummary[]> {
  return readJson(await fetch("/scans"));
}

export async function getScan(id: number): Promise<ScanDetail> {
  return readJson(await fetch(`/scans/${id}`));
}

export async function createScan(target: string, profile: ScanProfile): Promise<void> {
  const res = await fetch("/scans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, profile }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `request failed: ${res.status}`);
  }
}
