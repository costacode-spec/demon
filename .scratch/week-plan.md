# Week plan — make the scanner genuinely usable

_Set 2026-07-29. Theme: turn the raw spine into something usable daily._

**North star (by Friday):** run scans that are fast and scoped, and read the
results at a glance.

**Capacity:** ~6–10h. One feature guaranteed through the full loop; one small
stretch if time allows.

## Primary — Scan Profiles (built-in presets)  `ready to grill`

New domain term: **Scan Profile** (see `CONTEXT.md`). A validated enum on a
`Scan`, mapping to scanner flags. No table, no CRUD.

- `quick` → `nuclei -tags tech` (~seconds)
- `standard` → `nuclei -severity medium,high,critical`
- `full` → all templates (today's behaviour; the default)

Touches: `VulnerabilityScanner` port (accept a profile), scan-request shape +
API validation, `ScanService.requestScan`. Runs the full loop:
grill → spec → build + review + tests → commit → DEVLOG chapter.

## Stretch (if time) — usability UI touch

- Profile `<select>` on the scan form.
- Per-scan severity rollup in the list + `GET /scans/:id` (e.g. "2 high, 4 med").

Small: one dropdown, one severity-count query. No new domain concepts. Own loop,
or folded into the profiles commit if tiny.

## Not this week

- Findings **dedup + history** → **next week's primary**.
- User-defined profile entities/CRUD, ownership verification, Rust worker,
  event bus, more scanners, multi-tenant.

## Definition of done

- Scan Profiles shipped through all 5 loop steps (green tests, committed, DEVLOG
  chapter).
- Stretch shipped, or cleanly deferred with a note.
