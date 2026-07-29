import type { RawFinding } from "../src/domain/entities";
import type { VulnerabilityScanner } from "../src/domain/ports";

export const sampleFindings: RawFinding[] = [
  { templateId: "tls-version", severity: "low", matchedAt: "https://localhost:443", raw: { note: "fixture" } },
  { templateId: "exposed-panel", severity: "medium", matchedAt: "http://localhost:80", raw: { note: "fixture" } },
];

export class FakeScanner implements VulnerabilityScanner {
  constructor(private readonly findings: RawFinding[] = sampleFindings) {}
  async scan(): Promise<RawFinding[]> {
    return this.findings;
  }
}

export class ThrowingScanner implements VulnerabilityScanner {
  constructor(private readonly message = "tool exploded") {}
  async scan(): Promise<RawFinding[]> {
    throw new Error(this.message);
  }
}

// Lets a single registered worker swap scanner behaviour between tests.
export class SwitchableScanner implements VulnerabilityScanner {
  current: VulnerabilityScanner = new FakeScanner();
  scan(targetSpec: string): Promise<RawFinding[]> {
    return this.current.scan(targetSpec);
  }
}
