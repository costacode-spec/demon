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
import { registerScanWorker } from "../src/adapters/worker/scan-worker";
import { ScanService } from "../src/domain/scan-service";
import { FakeScanner, SwitchableScanner, ThrowingScanner, sampleFindings } from "./fixtures";

const url = process.env.DATABASE_URL;
// Fast + deterministic: real Postgres, faked scanner, no network. Skips
// entirely without a DB so a bare checkout never hard-fails.
const it = url ? test : test.skip;

let handle: DbHandle;
let boss: PgBoss;
let app: FastifyInstance;
const scanner = new SwitchableScanner();

before(async () => {
  if (!url) return;
  handle = createDb(url);
  await runMigrations(handle.db);
  boss = new PgBoss({ connectionString: url, pollingIntervalSeconds: 1 });
  await boss.start();
  await boss.createQueue(SCAN_QUEUE);

  const queue = new PgBossScanQueue(boss);
  const service = new ScanService(
    new DrizzleTargetRepository(handle.db),
    new DrizzleScanRepository(handle.db),
    new DrizzleFindingRepository(handle.db),
    queue,
    scanner,
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

async function submit(target = "http://localhost") {
  const res = await app.inject({ method: "POST", url: "/scans", payload: { target } });
  assert.equal(res.statusCode, 202);
  return res.json().id as number;
}

async function waitTerminal(id: number, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const body = (await app.inject({ method: "GET", url: `/scans/${id}` })).json();
    if (body.status === "succeeded" || body.status === "failed") return body;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("scan did not reach a terminal state in time");
}

it("scan succeeds and persists findings", async () => {
  scanner.current = new FakeScanner();
  const body = await waitTerminal(await submit());
  assert.equal(body.status, "succeeded");
  assert.equal(body.findings.length, sampleFindings.length);
  assert.equal(body.findings[0].templateId, sampleFindings[0].templateId);
});

it("scan failure is recorded, not lost", async () => {
  scanner.current = new ThrowingScanner("boom");
  const body = await waitTerminal(await submit());
  assert.equal(body.status, "failed");
  assert.equal(body.failureReason, "boom");
});

it("missing target is rejected", async () => {
  const res = await app.inject({ method: "POST", url: "/scans", payload: {} });
  assert.equal(res.statusCode, 400);
});

it("unknown scan id is 404", async () => {
  const res = await app.inject({ method: "GET", url: "/scans/999999" });
  assert.equal(res.statusCode, 404);
});
