import { asc, eq } from "drizzle-orm";
import type { FindingView, RawFinding } from "../../domain/entities";
import type { FindingRepository } from "../../domain/ports";
import type { Database } from "./db";
import { findings } from "./schema";

export class DrizzleFindingRepository implements FindingRepository {
  constructor(private readonly db: Database) {}

  async addMany(scanId: number, items: RawFinding[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(findings).values(
      items.map((f) => ({
        scanId,
        templateId: f.templateId,
        severity: f.severity,
        matchedAt: f.matchedAt,
        raw: f.raw ?? null,
      })),
    );
  }

  async listByScan(scanId: number): Promise<FindingView[]> {
    return this.db
      .select({
        templateId: findings.templateId,
        severity: findings.severity,
        matchedAt: findings.matchedAt,
      })
      .from(findings)
      .where(eq(findings.scanId, scanId))
      .orderBy(asc(findings.id));
  }
}
