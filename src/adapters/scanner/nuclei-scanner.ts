import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RawFinding, ScanProfile } from "../../domain/entities";
import type { VulnerabilityScanner } from "../../domain/ports";

const exec = promisify(execFile);

// ponytail: fixed small port list, not a full -p- sweep. Widen when coverage
// matters more than scan time.
const PORT_SCHEME: Record<number, string> = {
  80: "http", 8080: "http", 8000: "http", 3000: "http",
  443: "https", 8443: "https",
};

// The Scan Profile -> nuclei flags mapping. This is the only place that knows
// nuclei's CLI; the domain only knows the profile names. quick = tech-detection
// templates, standard = medium+ severity, full = the whole set.
const PROFILE_FLAGS: Record<ScanProfile, string[]> = {
  quick: ["-tags", "tech"],
  standard: ["-severity", "medium,high,critical"],
  full: [],
};

// Orchestrates nmap (discovery) + nuclei (detection). The concrete adapter
// behind the VulnerabilityScanner port; the Rust rewrite replaces this file.
export class NucleiScanner implements VulnerabilityScanner {
  // Fails loudly if nmap/nuclei are missing — no silent empty scans.
  static async create(): Promise<NucleiScanner> {
    await NucleiScanner.assertBinary("nmap");
    await NucleiScanner.assertBinary("nuclei");
    return new NucleiScanner();
  }

  private static async assertBinary(name: string): Promise<void> {
    try {
      await exec(name, ["--version"]);
    } catch {
      throw new Error(`Required tool '${name}' not found on PATH`);
    }
  }

  async scan(targetSpec: string, profile: ScanProfile): Promise<RawFinding[]> {
    const host = this.hostOf(targetSpec);
    const ports = await this.discoverHttpPorts(host);
    if (ports.length === 0) return [];
    const urls = ports.map((p) => `${p.scheme}://${host}:${p.port}`);
    return this.runNuclei(urls, profile);
  }

  private hostOf(targetSpec: string): string {
    try {
      return new URL(targetSpec).hostname;
    } catch {
      return targetSpec.trim();
    }
  }

  private async discoverHttpPorts(host: string): Promise<{ port: number; scheme: string }[]> {
    const ports = Object.keys(PORT_SCHEME).join(",");
    const { stdout } = await exec("nmap", ["-Pn", "-T4", "--open", "-p", ports, "-oG", "-", host]);
    const line = stdout.match(/Ports:\s*(.+)/);
    if (!line) return [];
    const open: { port: number; scheme: string }[] = [];
    for (const part of line[1].split(",")) {
      const m = part.trim().match(/^(\d+)\/open/);
      if (m) {
        const port = Number(m[1]);
        open.push({ port, scheme: PORT_SCHEME[port] ?? "http" });
      }
    }
    return open;
  }

  private async runNuclei(urls: string[], profile: ScanProfile): Promise<RawFinding[]> {
    const listPath = join(tmpdir(), `nuclei-${Date.now()}-${process.pid}.txt`);
    await writeFile(listPath, urls.join("\n"));
    // Optional extra flags (e.g. scope templates for a fast smoke test).
    const extra = process.env.NUCLEI_EXTRA_ARGS?.split(/\s+/).filter(Boolean) ?? [];
    // -no-stdin: essential — spawned with a piped (non-TTY) stdin, nuclei
    //   otherwise blocks forever reading targets from stdin despite -l.
    // -auth=false / -duc: never phone home (the PDCP cloud handshake hangs
    //   ~180s per scan when unreachable). This tool does not use the PD cloud.
    const base = ["-l", listPath, "-jsonl", "-silent", "-no-stdin", "-auth=false", "-duc"];
    // Order: base safety flags -> profile scope -> env override (wins last, so
    // the live smoke test can still force a single template regardless of profile).
    const args = [...base, ...PROFILE_FLAGS[profile], ...extra];
    try {
      const { stdout } = await exec("nuclei", args, { maxBuffer: 64 * 1024 * 1024 });
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const j = JSON.parse(line);
          return {
            templateId: j["template-id"] ?? j.templateID ?? "unknown",
            severity: j.info?.severity ?? null,
            matchedAt: j["matched-at"] ?? j.host ?? null,
            raw: j,
          } satisfies RawFinding;
        });
    } finally {
      await rm(listPath, { force: true });
    }
  }
}
