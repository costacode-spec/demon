# Spec: Vulnerability Scanner — Spine (MVP vertical slice)

Status: ready-for-agent

## Problem Statement

I run a set of network services I'm responsible for, and I have no repeatable way to check them for known vulnerabilities. Existing tools (nmap, Nuclei) are powerful but disconnected — I run them by hand, read raw terminal output, and have nowhere for the results to live. I want to submit a target, have it scanned, and see the findings in one place. Longer term this becomes a commercial scan-as-a-service product, so the foundation has to be mine to grow, and it must never scan a target its owner hasn't authorized.

## Solution

A service that accepts a **Target**, runs a **Scan** against it (discovery with nmap, then vulnerability detection with Nuclei), and stores the resulting **Findings** where I can read them back through an API and a simple web page. Scans run asynchronously because they take minutes to hours. Detection is orchestrated from mature existing tools rather than reinvented. Every Target carries a `verification_status`; in this slice my own targets are auto-verified, but the concept is modeled from day one so real ownership verification can be enforced before any external customer.

This spec covers **only the spine**: the thinnest thread that runs the entire pipeline once, end to end. Everything else is explicitly out of scope (see below).

## User Stories

1. As a security-conscious operator, I want to submit a target for scanning via an API, so that I don't have to run scanning tools by hand.
2. As an operator, I want each submitted target to become a persistent Target record, so that scans are always associated with a known asset.
3. As an operator, I want each scan submission to immediately return a scan identifier, so that I can track the scan without waiting for it to finish.
4. As an operator, I want scans to run asynchronously in the background, so that submitting a scan never blocks on a minutes-to-hours process.
5. As an operator, I want the scan to first discover which ports and services are open on the target, so that vulnerability checks only run against services that actually exist.
6. As an operator, I want the scan to run Nuclei against the discovered services, so that I get coverage of known vulnerabilities from maintained templates.
7. As an operator, I want each vulnerability that Nuclei reports to become a persistent Finding record linked to its scan, so that results are not lost when the terminal closes.
8. As an operator, I want to query a scan by its identifier and see its current status, so that I know whether it is queued, running, finished, or failed.
9. As an operator, I want to see all findings for a completed scan when I query it, so that I can review what was discovered.
10. As an operator, I want each finding to include at least a name/template id, a severity, and the affected service/URL, so that I can triage what matters first.
11. As an operator, I want a scan that fails (bad target, tool error) to be recorded as failed rather than silently disappearing, so that I can tell the difference between "no findings" and "the scan broke".
12. As an operator, I want a single plain web page that lists my scans, so that I can see scanning activity without calling the API by hand.
13. As an operator, I want to click a scan in that list and see its findings, so that I can review results in a browser.
14. As an operator, I want every Target to carry a verification status, so that the system has a place to enforce authorization before it ever scans on someone else's behalf.
15. As an operator scanning my own assets, I want my targets to be treated as verified automatically, so that I am not blocked by a verification step that isn't relevant yet.
16. As the future product owner, I want the scan worker to communicate only through a job queue and a findings contract, so that I can later rewrite the worker in another language without touching the web application.
17. As the future product owner, I want scan-lifecycle and finding events to exist as data the worker emits, so that I can later fan them out to an event backbone without a rewrite.
18. As an operator, I want the system to fail loudly at startup if the required external tools are missing, so that I don't get silent empty scans on a misconfigured machine.
19. As a developer, I want a fast, deterministic test suite that does not require live tools or network access, so that I can develop confidently.
20. As a developer, I want one live end-to-end smoke test against a local target I own, so that I know the real tool orchestration actually works.

## Implementation Decisions

**Domain vocabulary** (this repo has no glossary yet; these terms are established here and should be used consistently going forward): **Target**, **Scan**, **Finding**, **Scanner / tool runner**, **verification_status**.

**Architecture**
- Async job model, forced by long-running scans: an **API** enqueues a Scan, a **worker** runs it, **Postgres** stores state and results.
- **Node/TypeScript** for the MVP (API, worker, and web page).
- **Queue: pg-boss**, running inside the same Postgres instance — no Redis, no second datastore.
- The **worker** communicates only via (a) jobs pulled from the queue and (b) a findings-JSON contract it writes back. It has no other coupling to the web application. This boundary is deliberate so the worker can later be rewritten in Rust.
- Detection is **orchestrated, not reinvented**: the worker shells out to `nmap` (discovery / service identification) and then `nuclei` (vulnerability templates, `-jsonl` output), parsing their machine-readable output. No detection logic is written in-house.
- External binaries `nmap` and `nuclei` are runtime dependencies; the system checks for their presence at startup and fails loudly if absent.

**API contract**
- `POST /scans` accepts a target specification, creates (or reuses) a Target, creates a Scan in a queued state, enqueues a pg-boss job, and returns the scan identifier immediately.
- `GET /scans/:id` returns the Scan with its status and, when present, its associated Findings.
- Scan status is a small state set: queued → running → succeeded | failed.

**Schema (Postgres)**
- `targets`: identity, the target specification (host/IP/URL), and `verification_status` (auto-set to verified in this slice for the operator's own targets).
- `scans`: identity, foreign key to target, status, timestamps, and space for a failure reason.
- `findings`: identity, foreign key to scan, plus the fields carried from Nuclei output — at minimum a template/name identifier, severity, and the affected service or URL, with room for the raw finding payload.

**Worker behavior**
- Pull job → mark Scan running → run nmap against the target → run Nuclei against the discovered HTTP(S)/network services → parse JSONL → insert Finding rows → mark Scan succeeded. On any tool or parse error, mark Scan failed with a reason.
- The set of findings the worker produces is emitted as structured data (the findings contract), which is what gets persisted; this same shape is what a future event backbone would publish.

**Web page**
- A single plain React page (Vite): lists Scans; selecting one shows its Findings. No styling system, no routing framework beyond what one list-plus-detail view needs.

**Scanner set for this slice**
- `nmap` + `nuclei` only. No naabu, httpx, or ZAP yet.

## Testing Decisions

- **What a good test is here:** it drives the system through its external boundary and asserts on externally observable behavior — HTTP responses and persisted, readable state — never on internal function calls, private structure, or which tool flag was used.
- **Primary seam — the HTTP API.** The core tests submit a scan via `POST /scans` and then read it back via `GET /scans/:id`, asserting the scan reaches a terminal status and that findings appear. This single seam covers API + queue + worker + parsing + persistence together, which is the whole spine.
- **One injected dependency — the tool runner.** The component that shells out to nmap/nuclei is the only substituted dependency. Tests feed it canned nmap/nuclei JSONL fixtures so the suite is fast, deterministic, and needs neither the binaries nor the network. This keeps the number of seams at effectively one (the API), with a single controlled input.
- **One live smoke test.** Exactly one end-to-end test runs the real nmap and nuclei binaries against a **local throwaway target the operator owns** (e.g. a disposable local container) — never an external host — proving the real orchestration works. It is allowed to be slow and may be skipped when the binaries are absent.
- **Modules under test:** the API boundary (behavioral) and the worker's parse-and-persist path (via the API seam, with fixture input). The tool runner itself is exercised only by the single live smoke test.
- **Prior art:** none — this is a greenfield repo. The patterns established here (API-level behavioral tests, one injected tool-runner boundary, a single live smoke test) become the prior art for later features.

## Out of Scope

- **Ownership verification challenge** (DNS TXT / well-known-file / email). The `verification_status` field is modeled and auto-verified for own targets; the real challenge-response is deferred until before the first external customer.
- **Rust worker.** The worker is Node in this slice; its queue+contract boundary is designed so the rewrite is later and isolated.
- **Event backbone / Kafka.** Findings are emitted as structured events conceptually, but no bus is built; the choice among Kafka / NATS / Redis Streams is deferred and made on evidence, not now.
- **Additional scanners** (naabu, httpx, ZAP, network templates beyond the default set).
- **Finding deduplication, trending, and history across scans.**
- **Multi-tenant auth, users, roles, and any dashboard beyond the single list-plus-detail page.**
- **Notifications, ticket/webhook integrations, SIEM export, SLAs, metrics.**
- **Scheduling / recurring scans.**

## Further Notes

- **Authorization is legal survival, not a feature.** Active scanning sends attack-shaped traffic from our infrastructure; scanning an unauthorized target is a crime in most jurisdictions. This slice sidesteps the risk by scanning only the operator's own assets, but the `verification_status` field exists specifically so enforcement can be added before that assumption stops holding. Do not remove or bypass it.
- **The build-custom decision** is justified by product ownership, the AGPL licensing of alternatives like DefectDojo, and the owner's learning goals — not by a belief that existing tools' models don't fit. Detection itself is still orchestrated from existing tools.
- **Deliberate deferrals share one pattern:** design the seam now (verification field, worker contract, findings-as-events), build the heavy thing only when its need is real. Keep new work faithful to that pattern rather than pulling deferred scope forward.
- This spec was synthesized from a grilling + spec session on 2026-07-28; the surrounding decisions are recorded in the repo's agent memory under the vuln-scanner project.
