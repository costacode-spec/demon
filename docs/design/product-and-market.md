# Product & Market Design

_Status: design / direction — a target to build toward, not a description of what
exists today. Synthesized from a grill session on 2026-07-30. Numbers marked
**illustrative** are starting points for you to set, not committed prices._

## 1. What we're selling

An **affordable, fast, continuous vulnerability-scanning service** — operated by
us, delivering **vetted security reports** — that undercuts the cost and
turnaround of a traditional penetration test.

- **Offering (hybrid):** a one-off **assessment** to land a client → upsell to
  **continuous monitoring** (subscription).
- **Delivery model:** scan → **auto-drafted report** → **operator triage**
  (~30–60 min: drop false positives, prioritize) → **publish** to the client.
- **Two surfaces:** an **operator console** (manage clients & targets, run scans,
  triage, publish) and a read-only **client portal** (published/triaged reports +
  execution metadata — never raw output).

## 2. Ideal customer (ICP)

**SaaS startups that must prove security posture for enterprise sales, SOC 2, or
vendor security reviews.** Why this wedge:

- **Clear buying trigger** — a deal or an audit forces the purchase now.
- **Budget, no security team** — they'll pay to not hire, and can't operate raw
  tools themselves.
- **Underserved** — too small for enterprise suites, not ready for a $15–35k
  pentest.

## 3. Competitive landscape

| Alternative | What it is | Rough price | Gap we exploit |
|---|---|---|---|
| **Penetration test** (Blaze, Astra, boutique firms) | Human-led, deep, point-in-time | **$5k–30k** web app; **$15–35k** for a Series A–B SaaS; ~**$18.3k** avg | Expensive, slow (weeks), one-shot |
| **Intruder** | Self-serve continuous scanner | ~$149 entry; **Cloud $299/mo**, **Pro $499/mo**, per-target licenses | A tool you operate — no vetting, no report service |
| **Detectify** | External attack-surface + web scanning | **Deep Scan $85/mo**, **Asset Monitoring $420/mo**, multi-year push | Self-serve tool; broad but you interpret it |
| **Probely** | Web app scanner | ~15–30% under Detectify | Narrow, self-serve |
| **Compliance platforms** (Vanta/Secureframe) | SOC 2 automation | subscription | Do the paperwork, **not** deep scanning |

**Our position:** between the raw self-serve tools and the expensive pentest — a
**managed, human-vetted scan** at tool-like prices. The wedge is *"a fraction of
a pentest, delivered in days, repeated continuously."* We compete on **turnaround
+ vetted report + price**, not tooling breadth.

## 4. Pricing model

One-off **assessment fee** to land, then a **tiered monthly subscription** by
number of targets + scan frequency.

**Illustrative** starting shape (validate against real conversations):

| | One-off assessment | Starter | Growth | Scale |
|---|---|---|---|---|
| Price | **$500–1,500** | **$199/mo** | **$499/mo** | **$999/mo** |
| Targets | 1–3 | up to 3 | up to 10 | up to 25 |
| Cadence | once | monthly | weekly | weekly + on-demand |

Anchoring logic: the assessment is **~5–10% of a pentest** (easy yes); the
subscription sits **at or just above pure-tool competitors** (Intruder/Detectify)
because it *includes the human triage they don't* — you're paying for a vetted
report, not a dashboard.

## 5. Unit economics — the real constraint

Marginal **infrastructure** cost per client is trivial (nmap/nuclei compute +
a little Postgres — single-digit dollars/month). The binding cost is **operator
triage time**. This is the whole game:

> **The scaling bottleneck is operator time, not servers.** "Scale" means
> automating triage, not adding infrastructure — which is why the deployment
> stays simple across this entire horizon (see `system-design.md`).

**Illustrative throughput model** (one operator):

- ~45 min triage per report; ~3 focused triage-hours/day (rest is sales/support/
  build) → **~4 reports/day → ~80 reports/month**.
- A *monthly*-cadence client ≈ 1 report/mo; a *weekly*-cadence client ≈ 4×.
- A realistic solo book (mixed cadence, plus non-triage work): **~30–50 active
  clients**.
- At a **~$400 blended MRR/client**: **~$12k–20k MRR → ~$150k–240k ARR**, solo.

**The lever:** cut triage from ~45 min to ~10 min (better auto-drafting, in-tool
false-positive suppression, findings dedup/history) and the client ceiling
rises **~4×** — the same operator supports ~120–200 clients. That's the path from
a productized-service income to something that looks like a scalable product.

## 6. Market sizing — honest framing

- The broader **Security & Vulnerability Management market** was ~**$17.9B in
  2025**, growing ~**6.8–10% CAGR** (→ ~$24–49B by 2030–2035). **Managed**
  security services grow faster (~**11.6% CAGR**) — the tailwind is directly
  under our "managed, not self-serve" model.
- **Reality check:** we are not attacking that TAM. Our realistic serviceable
  slice as a solo/bootstrapped operator is **dozens of SaaS-startup clients →
  low-to-mid six-figure ARR**. That's a *profitable productized service*, not a
  VC-scale SaaS.
- **The upgrade path to "product":** if triage automation + a self-serve tier
  unlock **many small clients** without proportional operator time, the business
  crosses from services into product economics. Design for that seam (it's the
  third deployment tier), but don't build it until the volume is real.

## 7. Open decisions (not yet made)

- Final **price numbers** and tier boundaries (the table is illustrative).
- **Asset scope:** web apps only, or also APIs / cloud / external network? (Nuclei
  covers a lot; scope sets ICP fit and triage load.)
- **Report format & branding** — the client-facing deliverable's exact shape.
- Whether the assessment is **fixed-fee** or scoped per target count.

## Sources

- [Penetration testing cost (Astra)](https://www.getastra.com/blog/security-audit/penetration-testing-cost/)
- [Web app pentest cost 2025 (Bluefire)](https://bluefire-redteam.com/web-application-penetration-testing-cost-in-2025-complete-pricing-guide/)
- [Pentest cost avg $18,300](https://penetrationtestingcost.com/)
- [Intruder pricing (Beagle Security)](https://beaglesecurity.com/blog/article/intruder-pricing.html)
- [Detectify pricing (TrustRadius)](https://www.trustradius.com/products/detectify/pricing)
- [Security & Vulnerability Management market (Grand View Research)](https://www.grandviewresearch.com/industry-analysis/security-and-vulnerability-management-svm-market)
- [SVM market CAGR (Market.us)](https://market.us/report/security-vulnerability-management-market/)
