# demon — vulnerability scanner (spine)

The thinnest end-to-end slice: submit a target → nmap discovers services →
nuclei scans them → findings land in Postgres → read them back via API + a
plain web page. Scope and decisions live in `.scratch/vuln-scanner/spec.md`.

## Architecture

Hexagonal (ports & adapters). See `docs/adr/0001-hexagonal-architecture-and-drizzle.md`.

```
src/
  domain/     entities, ports (interfaces), scan-service  — imports no adapter
  adapters/
    persistence/  Drizzle repositories + schema     (ORM lives only here)
    queue/        pg-boss                            (ScanQueue port)
    scanner/      nmap + nuclei                      (VulnerabilityScanner port)
    http/         fastify routes                     → ScanService
    worker/       pg-boss consumer                   → ScanService.processScan
  main.ts     composition root — wires adapters into the domain
```

Rule: `domain/` never imports from `adapters/`. Schema changes → edit
`src/adapters/persistence/schema.ts`, then `npm run db:generate` (writes a plain
`.sql` migration under `drizzle/`, applied automatically on startup).

## Prerequisites

- Node 20.12+ (`--env-file-if-exists`)
- `nmap` and `nuclei` on PATH (only for real scans / the live test)
- Postgres (via the included compose file, or your own)

## Run

```sh
cp .env.example .env
docker compose up -d          # Postgres on :5432
npm install
npm run dev                   # API + worker on :3000
```

Open http://localhost:3000, submit a target you own, watch findings appear.

Or by API:

```sh
curl -XPOST localhost:3000/scans -H 'content-type: application/json' -d '{"target":"http://localhost"}'
curl localhost:3000/scans/1
```

## Test

```sh
npm test          # fast, deterministic; real Postgres, faked tools. Needs DATABASE_URL.
npm run test:live # one real nmap+nuclei scan of a LOCAL target you own. Slow, opt-in.
```

Tests skip themselves if `DATABASE_URL` is unset, so a bare checkout never
hard-fails. `test:live` additionally requires `RUN_LIVE=1` and the binaries.

> ⚠️ Only ever scan targets you own or are authorized to scan. Active scanning
> sends attack-shaped traffic from your machine. `LIVE_TARGET` must be local.
