# Spec: Scan Profiles (built-in presets)

Status: ready-for-agent

## Problem Statement

Every scan today runs nuclei's entire template set — a ~2–3 minute full sweep —
with no way to ask for something faster or more focused. As the operator, I want
to trade coverage for speed when I just need a quick look, or focus on
higher-severity issues, without editing code or flags by hand. A no-argument
scan should be *usable*, not a blind full run.

## Solution

Introduce a **Scan Profile**: a named preset chosen per scan that controls its
scope and speed. Three built-in presets:

- **`quick`** — technology-detection templates only (~seconds).
- **`standard`** — medium/high/critical severity templates. **The default.**
- **`full`** — the entire template set (today's behaviour).

`POST /scans` accepts an optional `profile`; omitted means `standard`. The chosen
profile is stored on the Scan and returned when reading it, so it's visible in
the API (and, via the stretch UI, the web page). Profiles are a fixed set this
iteration — no user-defined profiles yet.

Uses the vocabulary in `CONTEXT.md` (Scan, Scan Profile, Severity, Scanner).

## User Stories

1. As an operator, I want to submit a scan without specifying a profile and get
   a sensible fast-ish scan, so that the common case is quick and useful.
2. As an operator, I want to request a `quick` scan, so that I can get a result
   in seconds when I only need a shallow look.
3. As an operator, I want to request a `standard` scan, so that I focus on
   medium-and-above severity findings without the full-sweep wait.
4. As an operator, I want to request a `full` scan, so that I can still get
   maximum coverage when I need it.
5. As an operator, I want an unrecognized profile value to be rejected with a
   clear error listing the valid options, so that a typo never silently runs a
   different scan than I intended.
6. As an operator, I want the profile I chose recorded on the scan, so that when
   I look back I know why a scan found what it did.
7. As an operator, I want the profile returned when I read a scan (list and
   detail), so that a UI or script can display it.
8. As a developer, I want the profile concept to live in the domain and the
   nuclei-specific flags to live in the scanner adapter, so that the future Rust
   worker can map the same profiles to its own flags.
9. As a developer, I want a way to override scanner arguments in tests, so that
   the live smoke test can still force a single fast template regardless of
   profile.

## Implementation Decisions

**Domain (`domain/`)**
- Add `type ScanProfile = "quick" | "standard" | "full"` and a
  `SCAN_PROFILES` constant (the single source of truth for validation). No
  tool-specific knowledge in the domain.
- `ScanJob` gains a `profile: ScanProfile` field.
- `ScanView` and `ScanSummary` gain a `profile` field.
- The `VulnerabilityScanner` port method becomes `scan(targetSpec, profile)`.
- `ScanService.requestScan(targetSpec, profile)` records the profile on the new
  Scan and enqueues a `ScanJob` carrying it. `processScan` passes
  `job.profile` to the scanner. Default resolution (omitted → `standard`)
  happens at the API boundary, so the service always receives a concrete profile.

**Scanner adapter (`adapters/scanner/nuclei-scanner.ts`)**
- Owns the profile → nuclei-flags mapping:
  - `quick → ["-tags", "tech"]`
  - `standard → ["-severity", "medium,high,critical"]`
  - `full → []`
- Argument order: base safety flags (`-l`, `-jsonl`, `-silent`, `-no-stdin`,
  `-auth=false`, `-duc`) → profile flags → `NUCLEI_EXTRA_ARGS` (env, appended
  last so it wins). `NUCLEI_EXTRA_ARGS` remains the test/escape hatch.

**HTTP adapter (`adapters/http/server.ts`)**
- `POST /scans` accepts `{ target, profile? }`. Validate `profile` against
  `SCAN_PROFILES`; unknown → **HTTP 400** with a message listing valid values.
  Omitted → `standard`.
- `GET /scans` and `GET /scans/:id` include `profile` in their responses (via
  the extended `ScanSummary` / `ScanView`).

**Persistence (`adapters/persistence/`)**
- Add `scans.profile` (text, NOT NULL, default `'standard'`) to the schema.
- Generate one Drizzle migration (`npm run db:generate`); it applies on startup.
- Repositories: `create` accepts/records the profile; `findView` /
  `listSummaries` select and return it.

**Scan Profile as a value, not an entity** — no `profiles` table, no CRUD. The
documented upgrade path (user-defined profiles) is out of scope.

## Testing Decisions

- **Seams reused, no new ones.** Primary: the **HTTP API** (submit → read back).
  The one injected dependency remains the **`VulnerabilityScanner` port**
  (`FakeScanner`), whose `scan` signature gains `profile`.
- A good test asserts externally observable behaviour: HTTP responses and
  persisted/returned state — never which flag string was produced.
- New/updated tests (fast suite, real Postgres, faked scanner):
  - Default: submitting without a profile persists and returns `standard`.
  - Explicit: submitting `quick`/`full` persists and returns that value; the
    `FakeScanner` records the profile it was called with.
  - Invalid: `{ profile: "aggressive" }` → 400, and no scan row is created.
  - Existing success/failure/404 tests continue to pass.
- **The nuclei flag mapping** (profile → args) is unit-tested at the adapter
  level if it can be exercised without spawning nuclei; otherwise it's covered
  indirectly by the live smoke test. Do not assert flag strings through the API
  seam.
- **Live smoke test** unchanged in intent: default `standard` profile plus its
  `NUCLEI_EXTRA_ARGS` single-template override keeps it fast and deterministic.
- Prior art: `test/api.test.ts` (the existing API-seam behavioural tests) and
  `test/fixtures.ts` (the fake scanner) — extend these, don't invent a new
  harness.

## Out of Scope

- User-defined / named profiles, and any `profiles` table or CRUD.
- Per-profile timeouts, rate limits, or tag include/exclude beyond the three
  presets.
- Additional scanners (naabu/httpx/ZAP) and network templates.
- Findings dedup/history and the stretch usability UI (tracked separately; the
  read-side `profile` field is added here so the UI can consume it next).

## Further Notes

- The default flipping from full-sweep to `standard` is a deliberate behaviour
  change: a no-arg scan is now faster and severity-focused. `full` remains one
  explicit request away.
- Keeping the flag mapping in the adapter is what makes the planned Rust worker a
  clean swap: it will map the same `ScanProfile` values to its own invocation.
- Synthesized from a grill session on 2026-07-29; see `.scratch/week-plan.md`
  for where this sits in the week, and `CONTEXT.md` for the domain terms.
