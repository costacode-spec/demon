import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_SCAN_PROFILE, SCAN_PROFILES, type ScanProfile } from "../../domain/entities";
import type { ScanService } from "../../domain/scan-service";

// Delivery adapter: translates HTTP <-> the ScanService. No DB, no queue here.
export function buildServer(scanService: ScanService): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post("/scans", async (req, reply) => {
    const body = req.body as { target?: string; profile?: string } | undefined;
    const target = body?.target?.trim();
    if (!target) return reply.code(400).send({ error: "target is required" });

    const raw = body?.profile ?? DEFAULT_SCAN_PROFILE;
    if (!SCAN_PROFILES.includes(raw as ScanProfile)) {
      return reply.code(400).send({ error: `invalid profile; valid: ${SCAN_PROFILES.join(", ")}` });
    }
    const profile = raw as ScanProfile;

    const id = await scanService.requestScan(target, profile);
    return reply.code(202).send({ id, status: "queued", profile });
  });

  app.get("/scans", async () => scanService.listScans());

  app.get("/scans/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const scan = await scanService.getScan(id);
    if (!scan) return reply.code(404).send({ error: "not found" });
    return scan;
  });

  // Serve the built React app in production. Resolve relative to this file, not
  // the launch directory, so it works regardless of the process's cwd.
  // In dev the Vite server serves the UI and proxies API calls here, so the
  // build won't exist — fall back to a hint instead of a bare 404.
  const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "web", "dist");
  if (existsSync(distDir)) {
    app.register(fastifyStatic, { root: distDir });
  } else {
    app.get("/", async (_req, reply) =>
      reply
        .type("text/plain")
        .send(
          "UI not built. Dev: `cd web && npm run dev` (Vite proxies the API). " +
            "Single process: `cd web && npm run build`, then restart.",
        ),
    );
  }

  return app;
}
