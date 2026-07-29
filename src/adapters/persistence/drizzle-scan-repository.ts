import { desc, eq } from "drizzle-orm";
import type { ScanStatus, ScanSummary, ScanView } from "../../domain/entities";
import type { ScanRepository } from "../../domain/ports";
import type { Database } from "./db";
import { scans, targets } from "./schema";

export class DrizzleScanRepository implements ScanRepository {
  constructor(private readonly db: Database) {}

  async create(targetId: number): Promise<{ id: number }> {
    const [row] = await this.db.insert(scans).values({ targetId }).returning({ id: scans.id });
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
        failureReason: scans.failureReason,
        target: targets.spec,
        createdAt: scans.createdAt,
        updatedAt: scans.updatedAt,
      })
      .from(scans)
      .innerJoin(targets, eq(targets.id, scans.targetId))
      .where(eq(scans.id, id));
    return row ? { ...row, status: row.status as ScanStatus } : null;
  }

  async listSummaries(): Promise<ScanSummary[]> {
    const rows = await this.db
      .select({
        id: scans.id,
        status: scans.status,
        target: targets.spec,
        createdAt: scans.createdAt,
      })
      .from(scans)
      .innerJoin(targets, eq(targets.id, scans.targetId))
      .orderBy(desc(scans.id));
    return rows.map((r) => ({ ...r, status: r.status as ScanStatus }));
  }
}
