# Roadmap — from spine to production product

_Status: plan / direction. Confirmed via grill sessions on 2026-07-30. See
`product-and-market.md` for the business and `system-design.md` for the target
architecture. Each numbered item is one full loop: grill → spec → build →
review+test → commit → DEVLOG._

## How this is ordered

**Foundation-first:** items are sequenced by technical dependency — the deepest
data-model and analysis pieces first, client-facing polish later — so nothing
load-bearing has to be painfully retrofitted. Revenue gates are **annotated**
(where charging becomes possible) but do **not** drive the order.

Three market-hot features (see "Market-informed additions" below) are folded in
where they belong rather than bolted on: AI-assisted triage and
compliance/risk-ranked reporting enrich Phase 2; EASM-lite discovery is its own
small phase after the foundation.

## Where we are

**Built:** operator-side scanning spine — `POST /scans` → pg-boss → worker
(nmap + nuclei) → findings in Postgres → React UI with scan profiles + a
per-severity rollup. Single operator, own targets.

## Phase 1 — Core data model & analysis foundation

1. **Client entity** — a `Client` owns Targets / Scans / Findings / Reports
   (`client_id` threaded through). The anchor; retrofitting it later is the
   painful kind of change.
2. **Findings dedup + history** — stable finding identity; `new / seen / fixed`
   across scans of a target. The analysis base for triage + monitoring, and the
   lever that cuts triage time.

## Phase 1b — Discovery (EASM-lite)  ·  *market-informed*

3. **Asset / subdomain discovery** — add `subfinder` + `httpx` (same
   ProjectDiscovery family as nuclei) to auto-discover exposed subdomains/live
   hosts before scanning them. Independent of the data-model work; strengthens
   the assessment deliverable ("you have N forgotten exposed assets").
   *Authorized targets only.*
   - **Open design Q:** discovery scope (subdomains + live-host probing to start;
     ports/cloud later).

## Phase 2 — Reporting & triage (the deliverable)

4. **Report lifecycle + AI-assisted triage** — `Finding.triageStatus`
   (`new | confirmed | false_positive | suppressed`); `Report` moves
   `draft → triaged → published`; a triage UI in the operator console. An **LLM
   pre-classifies** each finding (likely false-positive? exploitability?) and
   **drafts remediation text**; the operator still approves. *This is where the
   triage-time bottleneck actually gets cut.*
   - **Open design Q (trust):** where client vulnerability data goes — Claude API
     (easy; data leaves our infra) vs a local/self-hosted model (private; more
     infra) vs AI-on-metadata-only. Plus per-report cost. Stays *assisted*: a
     human approves every published finding.
5. **Report generation / export — compliance-mapped + risk-ranked** — the
   client-facing artifact (HTML/PDF), findings **mapped to OWASP Top 10** (SOC 2
   later) and **ordered by exploitability (EPSS)**, not raw CVSS.
   - **Open design Q:** OWASP Top 10 first (nuclei templates already carry
     CWE/tags — cheap); SOC 2 mapping is fuzzier and later.

> **Revenue gate — paid one-off assessment.** After Phase 2 the "land" motion
> works end to end: Client → scan (+ discovery) → AI-assisted triage →
> compliance-mapped report, delivered manually. First money possible here.

## Phase 3 — Security & access foundation

6. **Auth + users + roles** — operator/client accounts, RBAC. No dependents
   until the portal, which is why it sits here.
7. **Ownership verification** — the `verification_status` challenge
   (DNS TXT / well-known-file). *A signed engagement covers authorization for the
   hand-sold assessment phase; the technical challenge becomes mandatory once a
   client self-adds targets or accesses the portal.*

## Phase 4 — Client-facing product

8. **Client portal** — read-only, scoped to the client's **published** reports +
   execution metadata (never raw output).

> **Revenue gate — continuous offering credible.** The portal is what makes the
> subscription real: clients watch posture change over time.

## Phase 5 — Continuous monitoring (subscription motion)

9. **Scheduler** — recurring scans on each client's cadence.
10. **Monitoring notifications** — email on new findings / report ready.

## Market-informed additions (why these three)

From a scan of what popular tools (Intruder, Detectify, Probely/Snyk, Astra,
StackHawk) ship in 2026, three trends map directly onto *our* model:

- **AI-assisted triage** → attacks our profitability bottleneck (operator time).
- **Compliance-mapped + risk-ranked reports** → match the ICP's exact buying
  trigger (SOC 2 / sales evidence) and reduce noise.
- **EASM-lite discovery** → cheap via the ProjectDiscovery stack we already use;
  makes assessments more compelling.

## Deferred — build only when a real signal arrives

- **API + authenticated scanning** (OAuth/JWT/OpenAPI) — market-hot and
  SaaS-relevant, but the biggest build (nuclei alone won't cover it well).
- **Dev-workflow integrations** (Jira / ServiceNow / Slack / CI) — for self-serve
  dev teams; our clients consume reports, so email/notify suffices near-term.
- **In-app billing (Stripe)** — decision deferred; manual invoicing first. The
  `Client.plan` field leaves the seam open.
- **Self-serve signup / many-small-clients (Tier 3)**, **perf seams** (Rust
  worker, event bus), and **more scanners / cloud scope** — only when needed;
  the ports are already in place (ADR-0001).

## Milestones at a glance

| Milestone | Phases | Unlocks |
|---|---|---|
| **Deliverable** | 1 · 1b · 2 | Charge a paid assessment (AI-triaged, compliance-mapped) |
| **Client-facing** | 3 · 4 | Clients self-serve view reports; trust + credibility |
| **Recurring** | 5 | Subscription monitoring; recurring revenue |
| **Scale** | Deferred | Only if volume / perf / integrations demand it |

## Sources (market scan)

- [DAST tools 2026 (Astra)](https://www.getastra.com/blog/dast/tools/)
- [Top DAST: APIs, CI/CD (Escape)](https://escape.tech/blog/top-dast-tools/)
- [Application security tools 2026 (Hackread)](https://hackread.com/top-application-security-tools-2026/)
- [Detectify vs Intruder (Detectify)](https://blog.detectify.com/industry-insights/product-comparison-detectify-vs-intruder/)
