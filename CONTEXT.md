# CONTEXT — ubiquitous language

The shared vocabulary for `demon`. When code, issues, specs, or the blog name a
domain concept, use the term as defined here. Created lazily as terms resolve —
add to it when a new concept earns a name, don't front-load it.

## Glossary

- **Target** — a host, IP, or URL to be scanned. Carries a
  `verification_status`. In the current MVP, targets are the operator's own
  assets and are auto-verified.

- **verification_status** — whether the operator's control of a Target has been
  established. Auto-`verified` for own assets today; a real ownership challenge
  (DNS TXT / well-known-file) is the deferred upgrade, required before any
  external user. This exists because active scanning of an unauthorized target
  is a crime — it is a legal gate, not a feature.

- **Scan** — one execution of the scanning pipeline against a Target. Has a
  `status`: `queued → running → succeeded | failed`. References a **Scan
  Profile**. Produces **Findings**.

- **Scan Profile** — a named preset that controls a Scan's scope and speed.
  Current values (a fixed, built-in set — the first rung):
  - `quick` — technology-detection templates only (~seconds).
  - `standard` — medium/high/critical severity templates.
  - `full` — the entire template set (today's default behaviour).
  A profile maps to scanner flags; it is not yet a user-editable entity. The
  documented upgrade path is **user-defined profiles** (a persisted entity with
  name + severity/tag filters) if and when presets prove too rigid.

- **Finding** — a single vulnerability the scanner reported for a Scan. Carries
  a `template_id`, `severity`, and `matched_at` (the affected service/URL).

- **Severity** — a Finding's level, from the scanner: `info | low | medium |
  high | critical`.

- **Scanner (VulnerabilityScanner)** — the port that performs detection: nmap
  for discovery, nuclei for vulnerability templates. The system **orchestrates**
  existing tools; it does not reinvent detection logic.

## Notes

- Architecture and ORM decisions live in `docs/adr/`.
- If a concept you need isn't here, that's a signal: either you're inventing
  language the project doesn't use (reconsider), or there's a real gap (add it).
