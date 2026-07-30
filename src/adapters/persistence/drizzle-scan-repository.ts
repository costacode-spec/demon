import { desc, eq, sql, type SQL } from "drizzle-orm";
import { SEVERITY_LEVELS } from "../../domain/entities";
import type {
  ScanProfile,
  ScanStatus,
  ScanSummary,
  ScanView,
  SeverityCounts,
  SeverityLevel,
} from "../../domain/entities";
import type { ScanRepository } from "../../domain/ports";
import type { Database } from "./db";
import { findings, scans, targets } from "./schema";

export class DrizzleScanRepository implements ScanRepository {
  constructor(private readonly db: Database) {}

  async create(targetId: number, profile: ScanProfile): Promise<{ id: number }> {
    const [row] = await this.db
      .insert(scans)
      .values({ targetId, profile })
      .returning({ id: scans.id });
    return { id: row.id };
  }

  async setStatus(
    id: number,
    status: ScanStatus,
    failureReason: string | null = null,
  ): Promise<void> {
    await this.db
      .update(scans)
      .set({ status, failureReason, updatedAt: new Date() })
      .where(eq(scans.id, id));
  }

  async findView(id: number): Promise<ScanView | null> {
    const [row] = await this.db
      .select({
        id: scans.id,
        status: scans.status,
        profile: scans.profile,
        failureReason: scans.failureReason,
        target: targets.spec,
        createdAt: scans.createdAt,
        updatedAt: scans.updatedAt,
      })
      .from(scans)
      .innerJoin(targets, eq(targets.id, scans.targetId))
      .where(eq(scans.id, id));
    return row
      ? { ...row, status: row.status as ScanStatus, profile: row.profile as ScanProfile }
      : null;
  }

  async listSummaries(): Promise<ScanSummary[]> {
    // Severity rollup in one query: LEFT JOIN findings and count per level with
    // conditional aggregation, so a scan with no findings still returns zeros.
    // Columns are derived from SEVERITY_LEVELS so the set lives in one place.
    const severityColumns = Object.fromEntries(
      SEVERITY_LEVELS.map((level) => [
        level,
        sql<number>`count(*) filter (where ${findings.severity} = ${level})`.mapWith(Number),
      ]),
    ) as Record<SeverityLevel, SQL<number>>;

    const rows = await this.db
      .select({
        id: scans.id,
        status: scans.status,
        profile: scans.profile,
        target: targets.spec,
        createdAt: scans.createdAt,
        ...severityColumns,
      })
      .from(scans)
      .innerJoin(targets, eq(targets.id, scans.targetId))
      .leftJoin(findings, eq(findings.scanId, scans.id))
      .groupBy(scans.id, targets.spec)
      .orderBy(desc(scans.id));

    return rows.map((r) => ({
      id: r.id,
      status: r.status as ScanStatus,
      profile: r.profile as ScanProfile,
      target: r.target,
      createdAt: r.createdAt,
      severityCounts: Object.fromEntries(
        SEVERITY_LEVELS.map((level) => [level, r[level]]),
      ) as SeverityCounts,
    }));
  }
}
