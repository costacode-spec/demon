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

## Product-level terms (design-stage — see `docs/design/`)

These come from the product design and are **not built yet**; they're recorded
so the language is consistent when we implement them.

- **Client** — a paying customer we scan *for* and deliver reports *to*. Owns
  Targets, Scans, and Reports. (Distinct from the operator, who runs the tool.)

- **Report** — the vetted deliverable produced from a Scan. Lifecycle:
  `draft` (auto-generated) → `triaged` (operator reviewed findings) →
  `published` (visible to the Client). The client only ever sees `published`.

- **triageStatus** (on a Finding) — the operator's verdict during review:
  `new | confirmed | false_positive | suppressed`. Only confirmed findings reach
  a published Report.

- **User / role** — `operator` (full control: scan, triage, publish) or
  `client` (read-only, scoped to their own Client's published reports).

- **Operator console** vs **Client portal** — the two surfaces: the operator's
  working tool vs the client's read-only report view.

## Notes

- Architecture and ORM decisions live in `docs/adr/`.
- If a concept you need isn't here, that's a signal: either you're inventing
  language the project doesn't use (reconsider), or there's a real gap (add it).
