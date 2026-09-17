# SautiLink — Architecture

## 1. Overview

SautiLink is a single Next.js 16 (App Router) application backed by PostgreSQL through Drizzle ORM.
There is no separate backend service: React Server Components read data directly, and mutations go
through zod-validated REST route handlers that enforce authorisation server-side.

```
┌────────────────────────── Browser (PWA) ──────────────────────────┐
│  (citizen) routes          service worker        localStorage      │
│  • /            home       • app-shell cache     • queue.v1        │
│  • /report      wizard     • network-first nav   • cases.v1        │
│  • /cases       queue      • API never stale                       │
│  • /assistant   Ask        AppProvider: language, Lite Mode,       │
│  • /track       lookup     connectivity, sync, toasts, speech      │
│  • /case/[id]   tracking                                           │
└───────────────┬────────────────────────────────────────────────────┘
                │ fetch (JSON)
┌───────────────▼────────────── Next.js server ──────────────────────┐
│ Route handlers (/api/**)          Server components                │
│  • zod validation                  • /institution/** (role-guarded)│
│  • rateLimit(ip, scope)            • /admin/**       (role-guarded)│
│  • getSession / requireRole        • /transparency   (public, safe)│
│  • case-service.ts  ← civic-ai.ts                                  │
└───────────────┬────────────────────────────────────────────────────┘
                │ Drizzle ORM
┌───────────────▼────────────────────────────────────────────────────┐
│ PostgreSQL: users · institutions · categories · cases · evidence · │
│ case_messages · case_status_history · case_notes ·                 │
│ community_signals · trusted_sources · notifications · audit_logs · │
│ sms_inbox                                                          │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Frontend

* **Route groups** — `(citizen)` renders a mobile-first shell (sticky header with connectivity /
  language / Lite Mode, bottom tab bar). `/institution` and `/admin` use `DashboardShell`, a
  responsive sidebar layout that collapses to a disclosure menu on small screens.
* **`AppProvider`** (`src/components/app-shell.tsx`) is the only global client state: language,
  Lite Mode, `navigator.onLine`, pending-queue count, synchronisation, toasts (`aria-live`) and
  speech synthesis. It registers the service worker in production only.
* **Design system** — Tailwind v4 `@theme` tokens in `globals.css`: deep teal brand ramp, warm amber
  accent, sand neutrals, explicit status colours, `.sl-card`, `.sl-rise`, `.sl-skeleton`. All motion
  is disabled under `prefers-reduced-motion` and under Lite Mode.
* **Server/client split** — data-heavy pages are server components (no client-side data fetching, no
  loading spinners, small payloads). Only interactive surfaces (wizard, case view, dashboards tools,
  admin actions) ship JavaScript.

## 3. Backend & API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/cases` | public (rate-limited) | Create a case; returns Case ID + access code |
| GET | `/api/cases/:publicId?code=` | access code **or** scoped institution/admin session | Read a case |
| POST | `/api/cases/:publicId/messages` | access code **or** scoped institution | Two-way messaging |
| POST | `/api/cases/:publicId/status` | institution (scoped) or admin | Status, priority, assignment, notes, message |
| POST | `/api/ai/classify` | public (rate-limited) | Category, urgency, routing, related count |
| POST | `/api/ai/assistant` | public (rate-limited) | Grounded civic answer + sources |
| POST | `/api/auth/login` `/logout` | public | Session issue/clear |
| POST | `/api/admin/actions` | admin | Categories, sources, institutions, users, moderation |
| POST | `/api/sms/simulate` | public (rate-limited) | **Prototype** SMS gateway webhook shape |
| GET | `/api/health` | public | Liveness + DB check |

Every handler: parse → validate (zod) → rate-limit → authorise → act → audit (where relevant) →
return a safe error message. No stack traces reach the client; server logs record messages only,
never report content.

## 4. Data model

* **`cases`** is the spine: `public_case_id` (unique), `access_code_hash`, category, description,
  AI fields (`ai_priority`, `ai_confidence`, `ai_institution_score`, `ai_notes`), `status`,
  `trust_level`, `anonymous`, `area_name`, `institution_id`, `channel`, timestamps.
* **Identity separation** — `users` exists only for staff and optional identified citizens. Anonymous
  cases carry no user reference at all, so there is no join that can re-identify a reporter.
* **`case_status_history`** is append-only and is the single timeline rendered to *both* citizen and
  institution — they literally see the same record.
* **`case_notes`** are staff-only; the API never returns them to a reporter.
* **`community_signals`** aggregates category × area counts, incremented on every new case.
* **`audit_logs`** records actor, role, action, target and metadata for staff/admin actions.
* Indexes exist on case category, status, institution and all `case_id` foreign keys.

## 5. Authentication & authorisation

* Passwords and case access codes: `scrypt` with a per-secret 16-byte salt, compared with
  `timingSafeEqual`.
* Sessions: compact base64url JSON + HMAC-SHA256 signature (`SAUTILINK_SECRET`), stored in an
  httpOnly, SameSite=Lax cookie, 12-hour expiry, `secure` in production.
* `requireRole([...])` guards mutating routes; layouts additionally `redirect()` unauthorised users.
* **Case-level scoping**: an institution user may only read or modify cases whose
  `institution_id` equals their own — verified against the database, not the request.

## 6. Offline synchronisation contract

```
create report ──online?──► POST /api/cases ──201──► store {caseId, accessCode} locally
       │ no
       ▼
enqueue(localStorage) → UI: "Waiting for connection" (explicitly: no Case ID yet)
       │ window "online" event / manual retry
       ▼
syncQueue(): for each item → POST /api/cases
       ├─ 2xx → saveCase(), removeQueued(), toast "submitted successfully"
       └─ err → attempts++, lastError stored, item stays in the queue
```

Design rules: (1) the server is the only issuer of Case IDs; (2) API responses are never served from
cache; (3) a failed online submission automatically falls back to the queue so a report is never
lost; (4) the queue is inspectable and editable by the user.

## 7. Anonymous reporting & messaging

Access to an anonymous case requires the Case ID **and** the access code, which is stored only as a
hash. The case API strips `accessCodeHash`, hides `reporterContact` from institutions and labels
reporter messages `Anonymous reporter`. The same thread is rendered in both the citizen case view and
the institution case detail, so an institution can ask for clarification and receive it without ever
learning who the reporter is.

## 8. AI integration

`src/lib/civic-ai.ts` is a pure, dependency-free module with four entry points — `classify`,
`matchInstitutions`, `findRelated`, `answerQuestion`. It is deterministic (same input → same output,
which makes it testable and demoable offline) and grounded: institution suggestions come only from
the `institutions` table, and assistant answers only from `trusted_sources` rows with their
`lastVerifiedAt` date attached.

**LLM_PROVIDER_HOOK** — to add a hosted model later, implement the same four function signatures in
an adapter, call it from `case-service.ts` / the AI routes, and keep the current engine as the
offline fallback. The grounding rules (only configured institutions, only dated sources, explicit
“couldn't verify” response) must be preserved by any adapter.

## 9. Evidence handling

Photos are compressed **on the device** (canvas → JPEG, max edge 900px / 640px in Lite Mode) before
they ever touch the network, then stored as a data URL on the `evidence` row with a size and label.
Evidence is private: it is returned to the reporter and the handling institution only, never to the
public dashboard, and is withheld from the admin payload. For production, `storage_ref` is the swap
point for an encrypted object store (S3-compatible) with signed URLs.

## 10. Trust model

`community_reported → evidence_submitted → community_corroborated → institution_responded → verified`

Trust is computed from facts the system can observe (evidence attached, ≥3 similar reports in the
same area, an institutional response, a recorded resolution) — never from the strength of an
allegation. The UI always explains the current level in plain language, and every public statement is
framed as *“community reports indicate…”*.

## 11. Notifications

`notifications` rows are written on case creation, every message and every status change, addressed
to `reporter` or `institution`. They surface **in context** — the citizen case timeline and messages
thread, the institution Messages screen — rather than in a separate inbox the user must hunt through.
The table is the integration point for future Web Push (the PWA already has a service worker).

## 12. Scalability & configurability

Countries, regions, institutions, categories, keywords, areas, SLAs, languages and trusted sources
are all **data**, not code. Expanding from Kenya to Tanzania, Ethiopia, Ghana or Nigeria means adding
institution and category rows plus one dictionary object — the routing engine, trust model, offline
queue and dashboards are unchanged.

## 13. Test matrix (manually verified)

| Flow | Checks |
| --- | --- |
| Citizen report (online) | 6-step wizard validation, AI review panel, Case ID + access code, copy/download |
| Citizen report (offline) | Queue entry, “Waiting for connection”, edit/delete, auto-sync on reconnect, Case ID only after sync |
| Anonymous access | Valid code opens case; wrong code returns 403; unknown Case ID returns 404 message |
| Messaging | Institution → reporter and reporter → institution, both directions visible, identity hidden |
| Institution | Queue filters, case detail, quick actions, status/priority/assignment, internal notes |
| Authorisation | Cross-institution update denied; admin routes reject anonymous callers; layouts redirect |
| Admin | Category create/toggle, source verify, user/institution suspend, moderation close, audit entries |
| Public | Aggregates exclude protection/safety/cohesion; no identities or evidence exposed |
| Accessibility | Keyboard traversal, focus visibility, screen-reader landmarks, reduced motion, read aloud |
| Responsive | 360px, 414px, 768px, 1024px, 1440px |
