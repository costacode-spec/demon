import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import PgBoss from "pg-boss";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/adapters/http/server";
import { createDb, runMigrations, type DbHandle } from "../src/adapters/persistence/db";
import { DrizzleFindingRepository } from "../src/adapters/persistence/drizzle-finding-repository";
import { DrizzleScanRepository } from "../src/adapters/persistence/drizzle-scan-repository";
import { DrizzleTargetRepository } from "../src/adapters/persistence/drizzle-target-repository";
import { PgBossScanQueue, SCAN_QUEUE } from "../src/adapters/queue/pgboss-scan-queue";
import { NucleiScanner } from "../src/adapters/scanner/nuclei-scanner";
import { registerScanWorker } from "../src/adapters/worker/scan-worker";
import { ScanService } from "../src/domain/scan-service";

// The one live end-to-end check: real nmap + nuclei against a LOCAL target you
// own. Never point LIVE_TARGET at a host you don't control. Opt-in + gated
// behind RUN_LIVE.
const url = process.env.DATABASE_URL;
const enabled = process.env.RUN_LIVE === "1" && !!url;
const it = enabled ? test : test.skip;
const target = process.env.LIVE_TARGET ?? "http://localhost";

let handle: DbHandle;
let boss: PgBoss;
let app: FastifyInstance;

before(async () => {
  if (!enabled) return;
  // Prove orchestration, not coverage: load one stable template (~1s run).
  process.env.NUCLEI_EXTRA_ARGS ??= "-t http/miscellaneous/robots-txt.yaml -timeout 5";

  handle = createDb(url!);
  await runMigrations(handle.db);
  boss = new PgBoss({ connectionString: url!, pollingIntervalSeconds: 1 });
  await boss.start();
  await boss.createQueue(SCAN_QUEUE);

  const queue = new PgBossScanQueue(boss);
  const service = new ScanService(
    new DrizzleTargetRepository(handle.db),
    new DrizzleScanRepository(handle.db),
    new DrizzleFindingRepository(handle.db),
    queue,
    await NucleiScanner.create(),
  );
  await registerScanWorker(queue, service);
  app = buildServer(service);
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (boss) await boss.stop({ graceful: false });
  if (handle) await handle.pool.end();
});

it("real nmap+nuclei scan of a local target reaches success", async () => {
  // Use the 'full' profile: NUCLEI_EXTRA_ARGS forces a single info-severity
  // template, which the 'standard' profile's severity filter would strip
  // (leaving nuclei with no templates -> error). 'full' applies no filter.
  const id = (
    await app.inject({ method: "POST", url: "/scans", payload: { target, profile: "full" } })
  ).json().id;
  const start = Date.now();
  let body: any;
  while (Date.now() - start < 60000) {
    body = (await app.inject({ method: "GET", url: `/scans/${id}` })).json();
    if (body.status === "succeeded" || body.status === "failed") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(body.status, "succeeded", `scan failed: ${body?.failureReason}`);
});
