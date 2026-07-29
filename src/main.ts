import PgBoss from "pg-boss";
import { buildServer } from "./adapters/http/server";
import { createDb, runMigrations } from "./adapters/persistence/db";
import { DrizzleFindingRepository } from "./adapters/persistence/drizzle-finding-repository";
import { DrizzleScanRepository } from "./adapters/persistence/drizzle-scan-repository";
import { DrizzleTargetRepository } from "./adapters/persistence/drizzle-target-repository";
import { PgBossScanQueue, SCAN_QUEUE } from "./adapters/queue/pgboss-scan-queue";
import { NucleiScanner } from "./adapters/scanner/nuclei-scanner";
import { registerScanWorker } from "./adapters/worker/scan-worker";
import { ScanService } from "./domain/scan-service";

// Composition root: the only place adapters and domain meet. Everything above
// is wired here; nothing else knows what concrete adapter it's talking to.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

// --- outbound adapters ---
const { db } = createDb(connectionString);
await runMigrations(db);

const boss = new PgBoss(connectionString);
await boss.start();
await boss.createQueue(SCAN_QUEUE);

const queue = new PgBossScanQueue(boss);
const scanner = await NucleiScanner.create(); // throws if nmap/nuclei missing

// --- domain, wired to adapters via ports ---
const scanService = new ScanService(
  new DrizzleTargetRepository(db),
  new DrizzleScanRepository(db),
  new DrizzleFindingRepository(db),
  queue,
  scanner,
);

// --- inbound adapters (triggers) ---
await registerScanWorker(queue, scanService);
const app = buildServer(scanService);
const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
console.log(`scanner up on :${port}`);
