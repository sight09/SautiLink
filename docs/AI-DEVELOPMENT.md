# SautiLink — AI Usage

Two very different things are described here, and they must not be confused:

1. **AI used to build SautiLink** — coding assistance during development.
2. **AI used inside SautiLink** — the Civic AI Engine that ships in the product.

---

## Part 1 — AI used during development (AI coding usage)

**Tool:** Claude (Anthropic) agentic coding assistant, with the developer reviewing, correcting and
testing every change. **Method:** inspect the repository first → plan → implement in vertical slices
→ run the code → fix what actually broke → re-validate.

### Development log

| # | Task | What AI generated / suggested | What the developer changed | Testing performed | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Requirements → architecture | Route map, data model, P0/P1 split from the brief | Merged the notifications inbox into case context; dropped a separate "drafts" table in favour of device-local storage (offline correctness) | Walked the whole demo journey on paper against the spec | Architecture doc |
| 2 | Drizzle schema | 13 tables with relations | Renamed a mis-cased column (`senderType` → `sender_type`); added indexes on case/status/institution; forced identity separation (no FK from anonymous case to user) | `drizzle-kit push` against a live PostgreSQL | Schema applied cleanly |
| 3 | Security module | scrypt hashing, HMAC sessions, rate limiter, ID generator | Added `timingSafeEqual` length guards, removed ambiguous characters from the Case-ID alphabet, made `requireRole` return 401 vs 403 distinctly, uniform login error text | Curl: wrong code → 403, wrong password → generic error, cross-institution write → 403 | Passed |
| 4 | Civic AI engine | Keyword classifier, urgency heuristics, institution scorer, assistant | Rewrote scoring so every suggestion carries **reasons**; added the de-escalation detector; forced the "I couldn't verify this" path instead of a confident guess | Unit-style probes through `/api/ai/classify` and `/api/ai/assistant` | Deterministic, explainable output |
| 5 | Offline queue + service worker | localStorage queue, SW caching | **Rejected** the generated cache-first API strategy — it would show cached data as if server-confirmed. Changed to network-first with an explicit offline error; ensured Case IDs are only ever server-issued | Offline → create → reconnect → sync; failed POST falls back to the queue | Honest offline behaviour |
| 6 | Report wizard | 6-step flow | Added on-device image compression, voice dictation, sensitive-category warning, per-step focus management, and a queue fallback when an online submit fails | Manual run of all six steps, validation boundaries, offline submit | Passed |
| 7 | Institution dashboard | Overview, queue, case detail | Added SLA/overdue SQL, server-side institution scoping on the detail page, internal-vs-public note separation, related-case panel | Signed-in curl on every dashboard route; cross-institution denial | Passed |
| 8 | Admin console | CRUD screens | Collapsed to a single audited `/api/admin/actions` endpoint with a discriminated-union schema; blocked self-suspension | Unauthenticated call → 401; category create → appears in the citizen flow | Passed |
| 9 | Seed data | Small sample dataset | Expanded to 141 cases so the "48 related reports" figure is **real data**, not a hard-coded number; added a case at `info_needed` for the live demo and one fully resolved case | Re-ran seed; verified counts in the public dashboard | Realistic dataset |
| 10 | Accessibility & polish pass | Markup suggestions | Added skip link, focus-visible ring, `aria-live` toasts, `role="switch"`, progress `aria-valuenow`, 44px targets, reduced-motion handling, empty/error states on every surface | Keyboard-only traversal, reduced-motion emulation, 360→1440px widths | Passed |
| 11 | Validation | — | Fixed a `TranslationKey` typing error and a const-assertion narrowing bug surfaced by strict TypeScript | `next typegen`, `tsc --noEmit`, `npm run build`, smoke suite | Green |

### What AI was *not* allowed to decide

* Privacy claims. Generated copy said “100% anonymous”; this was replaced with an honest statement
  plus a documented limitations list.
* Trust language. Any wording that presented an allegation as fact was rewritten to
  “community reports indicate…”.
* Fake functionality. Suggested placeholder buttons were either implemented or removed; the only
  simulated feature (SMS) is labelled **Prototype** in the UI, the API response and the docs.

---

## Part 2 — AI used inside the SautiLink product

`src/lib/civic-ai.ts` — a deterministic, dependency-free **Civic AI Engine**. It was a deliberate
engineering decision for this context: it runs server-side in milliseconds, needs no API key or data
budget, is reproducible for judges and auditors, and structurally cannot invent an institution or a
policy because it may only reference configured database records.

| Capability | Behaviour | Safety rule |
| --- | --- | --- |
| Classification | Category + confidence + matched terms | Always shown as a suggestion; the reporter's chosen category wins |
| Urgency | low/medium/high/critical + a stated reason | Sensitive categories are escalated for *human* review, never auto-actioned |
| Institution matching | Score with reasons (category, area, service type) | Only institutions configured in the database |
| Related reports | Count of similar reports in the same area | Surfaced, never auto-merged |
| De-escalation | Detects group-blame framing and redirects to service facts and evidence | Never amplifies or repeats the accusation |
| Ask SautiLink | Answers from dated trusted sources, with source and last-verified date | Says “I couldn't verify this information” rather than guessing |

Hard constraints: AI never determines guilt, never declares corruption as fact, never invents
policies or contacts, never auto-escalates a sensitive allegation, and never receives identity data.
Every AI surface in the UI carries an explicit “AI-assisted recommendation” label.

**Upgrade path:** a hosted LLM can be added behind the same four function signatures (see
`LLM_PROVIDER_HOOK` in `docs/ARCHITECTURE.md`), keeping the deterministic engine as the offline
fallback and preserving the grounding rules above.
