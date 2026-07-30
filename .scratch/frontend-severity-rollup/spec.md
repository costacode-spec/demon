# Spec: React frontend + per-scan severity rollup

Status: ready-for-agent

## Problem Statement

The web page is a single inline vanilla-JS string. It works, but it can't grow —
there's no component structure, no build tooling, and no way to see a scan's
weight without opening it. As the operator, I want to choose a Scan Profile from
the form and see at a glance how bad each scan is (how many high/medium findings)
directly in the list, and I want the UI built on something I can extend.

## Solution

Two parts:

1. **A Vite + React (TypeScript) frontend** replacing the inline page — a real
   component structure to grow the product's UI on. Served as a single
   deployable: Fastify serves the built assets in production; in development the
   Vite dev server proxies API calls, so there's one origin and no CORS.

2. **A per-scan severity rollup** — each row in the scan list shows a summary of
   its Findings by Severity (e.g. "2 high, 4 medium"), computed by the database
   in one query and exposed on the scan list response.

Uses `CONTEXT.md` vocabulary (Scan, Scan Profile, Finding, Severity). Adds a
"Severity summary" read-model entry to the glossary.

## User Stories

1. As an operator, I want to pick a Scan Profile from a dropdown on the scan
   form, so that I don't have to hand-craft an API request to choose one.
2. As an operator, I want the profile dropdown to default to `standard`, so that
   the common case matches the API default.
3. As an operator, I want to submit a scan from the form with my chosen target
   and profile, so that starting a scan stays a one-click action.
4. As an operator, I want each scan in the list to show its profile, so that I
   know how it was run.
5. As an operator, I want each scan row to show a severity rollup of its
   findings, so that I can spot the worst scans without opening each one.
6. As an operator, I want a scan with no findings (or still running) to show
   zeros rather than break, so that the list is always readable.
7. As an operator, I want to click a scan and see its full findings, so that I
   can drill into details (unchanged from today).
8. As an operator, I want the list to keep refreshing so I see status change from
   queued to running to succeeded without reloading.
9. As a developer, I want the frontend to be its own build with isolated
   dependencies, so that frontend and backend concerns don't tangle.
10. As a developer, I want dev-mode hot reload with API calls proxied to the
    backend, so that the inner loop is fast and there's no CORS setup.
11. As an operator/ops, I want a single process to deploy (API + built UI), so
    that there are fewer moving parts to run.
12. As a developer, I want the severity rollup computed in one database query,
    so that listing scans doesn't fan out into per-scan requests.

## Implementation Decisions

**Frontend (new `web/` app)**
- Vite + React + TypeScript, in a `web/` directory with its own `package.json`
  and dependencies (react, react-dom, vite, the React plugin, typescript),
  isolated from the backend package.
- Components: a scan form (target input + profile `<select>` defaulting to
  `standard`), a scan list (row shows id, status, profile, target, and severity
  badges from the rollup), and a scan detail view (findings — as today).
- Data access: plain `fetch` with React state/effects; keep the ~2s auto-refresh
  of the list. No data-fetching library.
- Styling: minimal plain CSS, no framework.

**Serving (single deployable)**
- Production: the backend serves the built frontend assets via `@fastify/static`;
  the existing `/scans` API routes are unchanged; the inline HTML page is removed.
- Development: the Vite dev server serves the UI and proxies API paths to the
  backend, so both run with one command and share an origin.

**Severity rollup (backend)**
- `ScanSummary` gains a `severityCounts` field:
  `{ critical, high, medium, low, info }` (integers). Findings whose severity is
  null/unrecognized are not counted in these buckets.
- Computed in a **single query** using conditional aggregation
  (`count(*) FILTER (WHERE severity = …)` per level) with a LEFT JOIN from scans
  to findings, so scans with zero findings return zeros. No extra round-trips per
  scan.
- `GET /scans` returns `severityCounts` per row. `GET /scans/:id` is unchanged
  (it already returns the full findings list; the client can summarize there if
  needed).
- No change to how findings are stored; this is a read-model addition only.

**Architecture**
- Per ADR-0001 (hexagonal): the rollup is a read concern of the scan repository
  (an adapter detail); the domain `ScanSummary` type gains the field. The React
  app is a separate client, outside the Node hexagon, talking to the same HTTP
  port.

## Testing Decisions

- A good test asserts externally observable behaviour, not implementation. The
  risky logic here is the **SQL aggregate**, and it is tested through the
  existing **HTTP API seam** — no new seam.
- Backend tests (extend `test/api.test.ts`): create a scan, have the faked
  scanner return findings spanning several severities, run it to completion, then
  assert `GET /scans` returns the correct `severityCounts`; and assert a scan
  with no findings returns all-zero counts. These reuse the fake
  `VulnerabilityScanner` and the API-seam pattern already established.
- The React layer is intentionally thin (fetch + render); **no component-test
  framework is introduced**. Its correctness is covered by the API contract plus
  manual/`vite build` verification. If a smoke render is cheap it may be added,
  but a test harness for the UI is out of scope.
- Prior art: `test/api.test.ts` (API-seam behavioural tests), `test/fixtures.ts`
  (fake scanner).

## Out of Scope

- A data-fetching library (react-query/SWR), a CSS framework, and a component
  testing framework.
- Pagination, filtering, or sorting of the scan list.
- Any authentication or access control on the UI.
- Severity counts on `GET /scans/:id` (detail already returns full findings).
- User-defined scan profiles (still the documented upgrade path).

## Further Notes

- This deliberately escalates the week's "small UI touch" into a real frontend,
  by decision. It likely consumes the remainder of the week and may carry over;
  that trade was made knowingly for a UI foundation worth building on.
- Keeping it a single deployable (Fastify serving the build) mirrors the
  "few moving parts" ethos behind pg-boss-on-Postgres — defer CORS and a second
  deploy target until external hosting actually requires them.
- Synthesized from a grill session on 2026-07-30; see `.scratch/week-plan.md`
  and `CONTEXT.md`.
