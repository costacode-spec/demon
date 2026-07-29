import type { Target } from "../../domain/entities";
import type { TargetRepository } from "../../domain/ports";
import type { Database } from "./db";
import { targets } from "./schema";

export class DrizzleTargetRepository implements TargetRepository {
  constructor(private readonly db: Database) {}

  // MVP: own assets are auto-verified (schema default). The real ownership
  // challenge slots in here before any external customer.
  async upsert(spec: string): Promise<Target> {
    const [row] = await this.db
      .insert(targets)
      .values({ spec })
      .onConflictDoUpdate({ target: targets.spec, set: { spec } })
      .returning();
    return { id: row.id, spec: row.spec, verificationStatus: row.verificationStatus };
  }
}
