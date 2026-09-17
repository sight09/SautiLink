# SautiLink — Speak safely. Track change.

<p align="center">
  <img src="./public/icons/icon.svg" alt="SautiLink logo" width="128" />
</p>

> *Sauti* means **voice** in Swahili.
> Most reporting platforms stop at **“Submit.”** SautiLink continues all the way to **“Resolved.”**

SautiLink is an offline-capable, privacy-conscious civic technology platform that helps African
communities safely report public-service failures, safety concerns and civic problems; understand
what to do next; communicate with the responsible institution **without revealing their identity**;
and track a case from reporting to resolution.

```
REPORT → PROTECT → VERIFY → ROUTE → RESPOND → TRACK → RESOLVE
```

---

## Problem

A person knows something is wrong — the tap has been dry for two weeks, the street lights have been
off for a month, the dispensary has no medicine. What they usually do **not** know is:

* where to report it, and who is actually responsible;
* what evidence is useful, and what their rights are;
* whether reporting will expose them to retaliation;
* whether anyone will ever respond;
* how to follow up when the network is unreliable or absent.

## Solution

SautiLink turns a concern into an **actionable, trackable case** and makes the institutional response
visible — while protecting the reporter.

| Capability | What it means in the product |
| --- | --- |
| **Anonymous reporting** | No name, phone or email collected. Case content is stored with no link to an account. |
| **Anonymous two-way messaging** | Institutions ask questions; reporters answer using only a Case ID + access code. |
| **Offline-first reporting** | Write and save a report with no signal. Nothing is claimed as “received” until a server truly receives it. |
| **Trust & verification model** | Every case shows whether it is *community reported*, *evidence submitted*, *community corroborated*, *institution responded* or *verified*. |
| **Institutional response** | A real desk workflow: acknowledge → request info → respond → assign → progress → resolve, each timestamped. |
| **Case tracking** | A single timeline shared by citizen and institution. |
| **Community signals** | Aggregated independent reports — the pattern, never an accusation. |
| **Public accountability** | Privacy-safe aggregates; sensitive categories excluded entirely. |
| **Low-bandwidth Lite Mode** | Device-side photo compression, suppressed imagery/animation, lean payloads. |
| **SMS fallback (prototype)** | Gateway-shaped webhook, clearly labelled — no real SMS is transmitted. |
| **English / Swahili** | Dictionary-driven localisation ready for Amharic, Afaan Oromo, Hausa, Yoruba, isiZulu, French, Arabic, Portuguese. |

---

## Key features by user

### Citizens (mobile-first PWA)
Report safely · Ask SautiLink · Check my case · Find a service · Pending reports queue ·
Read-aloud · Lite Mode · Language switch · Install to home screen.

### Institutions (responsive desktop dashboard)
Overview with SLA/overdue tracking · filterable case queue · case detail with evidence, AI analysis,
related reports, internal notes and anonymous conversation · quick actions (acknowledge, request
info, respond, progress, resolve) · messages · community signals · analytics · settings.

### Platform administrators
Platform overview · staff & institution management (suspend/reactivate) · category management
(create/enable/disable, keywords feeding the classifier) · trusted-source verification · localisation
status · moderation review queue (sensitive, critical, stalled) · full audit log.

---

## Architecture

```
Next.js 16 App Router (React 19, Tailwind v4)
├── (citizen)      mobile-first PWA routes      → service worker + localStorage queue
├── /institution   role-guarded desk dashboard  → server components + mutation APIs
├── /admin         role-guarded admin console
└── /api           REST route handlers (zod-validated, rate-limited, role-checked)
        │
        ├── lib/civic-ai.ts     deterministic civic engine (classify, urgency, routing,
        │                       duplicates, de-escalation, grounded assistant)
        ├── lib/case-service.ts case creation, access checks, status, audit, aggregates
        ├── lib/security.ts     scrypt hashing, HMAC sessions, RBAC, rate limiting, ID generation
        └── db (Drizzle ORM)    PostgreSQL
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, including the offline
synchronisation contract and the anonymous-access model.

### Technology stack

* **Next.js 16** (App Router, React 19 Server Components)
* **TypeScript**, strict mode
* **Tailwind CSS v4** with a custom design-token theme
* **PostgreSQL** + **Drizzle ORM**
* **zod** for every request payload
* **Node crypto** (scrypt + HMAC) — no external auth dependency
* **Service worker + localStorage** for offline shell and report queue

---

## Offline architecture

1. The service worker pre-caches the app shell (`/`, `/report`, `/cases`, `/assistant`, `/track`,
   `/settings`, `/offline`). Navigation is network-first with an offline fallback; API requests are
   **never** served stale from cache, so cached data is never mistaken for server-confirmed data.
2. Submitting while offline writes the report to a device-local queue (`sautilink.queue.v1`) and
   shows **“Waiting for connection.”** No Case ID is invented.
3. On `online`, the app shows **“Connection restored — synchronising…”**, POSTs each queued report,
   and only then stores the server-issued Case ID and access code.
4. `/cases#pending` lists every queued report with view / edit / delete / retry actions.

## Anonymous reporting architecture

* Anonymous cases store `reporter_user_id = NULL` and `reporter_contact = NULL`.
* Each case receives a public ID (`CS-82A91-K7X`) and a separate 6-character access code; only a
  **scrypt hash** of the access code is stored — it cannot be recovered, only verified.
* Reading a case or posting a message requires either a verified access code or an institution
  session scoped to that case's institution. Both are enforced server-side.
* Institutions always see “Anonymous reporter”; the API strips `accessCodeHash` and withholds
  `reporterContact` from anyone but the reporter.

## AI features

The **Civic AI Engine** (`src/lib/civic-ai.ts`) is deterministic and explainable by design — it runs
in milliseconds, needs no API key or connectivity budget, and *cannot* hallucinate an institution or
a policy because it may only reference configured records.

* **Classification** with confidence and the matched terms that produced it.
* **Urgency suggestion** (low/medium/high/critical) with a stated reason.
* **Institution matching** with a percentage score and the reasons for the match.
* **Duplicate / related-report detection** — surfaced, never auto-merged.
* **De-escalation guidance** when a report attributes blame to a group, redirecting to service facts
  and evidence (Stability & Social Cohesion).
* **Ask SautiLink** answers only from dated, configured trusted sources, shows source + last-verified
  date, and says *“I couldn't verify this”* rather than guessing.

Every AI surface in the UI is labelled **“AI-assisted recommendation.”** AI never determines guilt,
never escalates automatically and never sees identity data.

---

## Security & privacy

Highlights (full detail in [`docs/SECURITY.md`](docs/SECURITY.md)):

* scrypt password and access-code hashing; HMAC-signed, httpOnly, 12-hour sessions.
* Role-based authorisation enforced in every route handler (`requireRole`), never only in the UI.
* Per-IP rate limiting on case creation, case reads, messaging, login and AI endpoints.
* zod validation on every request body; uniform sign-in errors (no account enumeration).
* Audit logging of institutional and administrative actions.
* Data minimisation: approximate area only, no GPS; sensitive categories excluded from public data.
* Honest limitations are documented in-product on the Settings → Privacy screen.

## Accessibility

Semantic landmarks and headings · skip link · visible 3px focus rings · ≥44px touch targets ·
icons always paired with text · `aria-live` toasts, `aria-pressed`/`aria-current`/`role="switch"` ·
progress bar with `aria-valuenow` · form errors that explain recovery · **Read aloud** on key screens
(Web Speech) · voice dictation in the report flow · full `prefers-reduced-motion` support ·
Lite Mode for users on constrained devices.

## Multilingual support

`src/lib/i18n.ts` holds the dictionary, status/trust vocabulary and locale-aware date formatting.
Categories and trusted sources carry English and Swahili fields in the database. Adding a language =
one dictionary object + `LANGUAGES` entry + translated data rows. Language choice persists on device
and is sent with reports so the assistant answers in the same language.

---

## Setup

### Requirements
Node 20+, PostgreSQL 14+.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SAUTILINK_SECRET` | production | HMAC key for session signing (defaults to a dev value locally) |

Create `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
SAUTILINK_SECRET=change-me-in-production
```

No secrets are committed to the repository.

### Database setup & seed data

```bash
npm install
npx drizzle-kit push --config drizzle.config.json   # create tables
npx tsx src/db/seed.ts                              # load the pilot dataset
```

The seed creates a realistic Nairobi County pilot dataset (all fictional, flagged `demo_data`):
**141 cases** — Water 48, Roads 31, Healthcare 19, Education 14, Public facilities 11, Safety 9,
Environment 8 — with timelines, evidence, messages, 5 community signals, 5 institutions,
5 trusted sources and an SMS prototype inbox.

**Demo credentials**

| Purpose | Value |
| --- | --- |
| Featured case | `CS-82A91-K7X` · access code `SAUTI1` |
| Seeded community cases | access code `DEMO12` |
| Institution (water) | `water@sautilink.demo` / `Demo1234!` |
| Institution (roads) | `roads@sautilink.demo` / `Demo1234!` |
| Administrator | `admin@sautilink.demo` / `Demo1234!` |

### Running locally

```bash
npm run dev     # http://localhost:3000
npm run build && npm run start
```

### Deployment

Any Node host with a PostgreSQL database: set `DATABASE_URL` and `SAUTILINK_SECRET`, run
`drizzle-kit push`, optionally seed, then `npm run build && npm run start`. The service worker only
registers in production builds.

## Testing

```bash
npm run build                      # type-safe production build
npx tsc --noEmit                   # strict type check
node tests/smoke.mjs               # end-to-end API + authorisation suite (server must be running)
```

`tests/smoke.mjs` covers: case creation, anonymous access control (valid vs invalid code), anonymous
two-way messaging, institution response and status transitions, cross-institution access denial,
unauthenticated admin rejection, validation failures, rate-limit shape, the AI endpoints and the SMS
prototype. Manual test matrix and the full demo script are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## AI coding usage

This project was built with heavy, deliberate use of AI coding tools — and the code was reviewed,
corrected and tested by the developer. See [`docs/AI-DEVELOPMENT.md`](docs/AI-DEVELOPMENT.md), which
separates **AI used to build SautiLink** from **AI used inside SautiLink**.

---

## Competition demo script (≈3 minutes)

1. **Offline moment** — DevTools → Offline. The app still opens; create a report; see
   *“Waiting for connection.”* Go online → *“Connection restored — synchronising…”* → Case ID issued.
2. **Anonymous moment** — submit a water report anonymously → **Identity protected** → Case ID +
   access code, copy/download.
3. **Trust moment** — open the case: Trust & Evidence panel distinguishes report, evidence,
   corroboration and official response.
4. **Institution moment** — sign in as `water@sautilink.demo`, open `CS-82A91-K7X`, see
   **48 related community reports** and the AI match at 87%; click **Request information**.
5. **Anonymous reply moment** — back as the citizen (`/track` → `CS-82A91-K7X` / `SAUTI1`), reply
   *“near the northern entrance.”* The institution sees only “Anonymous reporter”.
6. **Resolution moment** — institution: **Send official response** → **Mark work in progress** →
   **Resolve case**. The citizen timeline reaches **RESOLVED**.
7. **Accountability moment** — `/transparency` shows the aggregate movement with no personal data.

## Competition track alignment

* **Transparency & Accountability** — end-to-end case lifecycle, institutional SLAs, public
  accountability dashboard, immutable audit log.
* **Safety, Reporting & Protection** — anonymous reporting and messaging, hashed access codes,
  sensitive categories with extra safeguards and public-dashboard exclusion.
* **Stability & Social Cohesion** — de-escalation guidance, aggregated signals framed as service
  problems rather than accusations, mediation-oriented routing.

## Future roadmap

Real SMS/USSD gateway (Africa's Talking) · WhatsApp intake · additional African languages ·
object storage with server-side encryption for evidence · optional LLM layer behind the existing
`civic-ai` interface with the same grounding rules · push notifications · geographic clustering ·
institution SLA scorecards · native packaging via Capacitor.
