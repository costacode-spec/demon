import type { RawFinding, ScanProfile } from "../src/domain/entities";
import type { VulnerabilityScanner } from "../src/domain/ports";

export const sampleFindings: RawFinding[] = [
  { templateId: "tls-version", severity: "low", matchedAt: "https://localhost:443", raw: { note: "fixture" } },
  { templateId: "exposed-panel", severity: "medium", matchedAt: "http://localhost:80", raw: { note: "fixture" } },
];

export class FakeScanner implements VulnerabilityScanner {
  lastProfile: ScanProfile | null = null;
  constructor(private readonly findings: RawFinding[] = sampleFindings) {}
  async scan(_targetSpec: string, profile: ScanProfile): Promise<RawFinding[]> {
    this.lastProfile = profile;
    return this.findings;
  }
}

export class ThrowingScanner implements VulnerabilityScanner {
  constructor(private readonly message = "tool exploded") {}
  async scan(_targetSpec: string, _profile: ScanProfile): Promise<RawFinding[]> {
    throw new Error(this.message);
  }
}

// Lets a single registered worker swap scanner behaviour between tests.
export class SwitchableScanner implements VulnerabilityScanner {
  current: VulnerabilityScanner = new FakeScanner();
  scan(targetSpec: string, profile: ScanProfile): Promise<RawFinding[]> {
    return this.current.scan(targetSpec, profile);
  }
}
