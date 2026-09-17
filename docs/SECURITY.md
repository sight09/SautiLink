# SautiLink — Security & Privacy

SautiLink handles reports from people who may face retaliation. This document states exactly what the
prototype does, and — just as importantly — what it does **not** yet do.

## 1. Authentication

* Staff accounts only (institution, administrator) plus optional citizen accounts. **Citizens never
  need an account to report, track or reply.**
* Passwords: `scrypt` (N=16384 default, 32-byte key) with a unique 16-byte salt per record, stored as
  `salt:hash`, verified with `timingSafeEqual`.
* Sessions: `base64url(JSON) + "." + HMAC-SHA256(payload, SAUTILINK_SECRET)`, 12-hour expiry, stored
  in an **httpOnly, SameSite=Lax** cookie, `secure` in production. No session data is readable or
  forgeable by the client.
* Sign-in failures always return the same message (“Email or password is incorrect”) so accounts
  cannot be enumerated, and are rate-limited to 8 attempts per IP per minute.

## 2. Authorisation

Enforced in the route handler / server component, never only in the UI:

| Actor | May access |
| --- | --- |
| Anonymous reporter | One case, with a verified access code |
| Institution staff | Only cases whose `institution_id` matches their own (checked against the DB) |
| Administrator | Case metadata, configuration, moderation, audit — evidence payloads are withheld |

`requireRole()` returns 401 for unauthenticated and 403 for wrong-role callers. Dashboard layouts
additionally `redirect()`, so a deep link cannot render a protected page shell.

## 3. Anonymous reporting

* Anonymous cases store `reporter_user_id = NULL`, `reporter_contact = NULL` — there is no join path
  from a case to a person.
* Case access code: 6 characters from a 32-symbol unambiguous alphabet (~30 bits), generated with
  `crypto.randomBytes`, stored **hashed**. SautiLink cannot recover or display it again; this is
  stated to the user at issue time.
* Public Case IDs (`CS-XXXXX-XXX`) are also random — they are not sequential and leak no volume
  information.
* Reading and messaging both re-verify the code on every request; there is no long-lived anonymous
  session.

We deliberately do **not** claim “100% anonymous”. See Known limitations.

## 4. Data minimisation

* No GPS. Reports carry an **approximate area** chosen from a configured list, plus an optional
  free-text landmark the reporter controls.
* No name, phone or email on anonymous reports; identified reports store exactly one contact string.
* Sensitive categories (`protection`, `safety`, `cohesion`) are excluded from all public aggregates
  and signals.
* Local device data (`sautilink.queue.v1`, `sautilink.cases.v1`) can be erased by the user from
  Settings → Privacy.

## 5. Evidence protection

* Photos are compressed on-device before upload (smaller attack surface, lower bandwidth, less
  incidental detail).
* Evidence is returned only to the verified reporter and the handling institution; the public
  dashboard never exposes it, and the admin payload omits binary content.
* Upload size is bounded (≤5 items, ≤400 kB payload per item, validated server-side).

## 6. API security

* Every request body is validated with zod; unknown/oversized fields are rejected.
* In-memory per-IP rate limits: case creation 12/min, case reads 40/min, messages 20/min, login
  8/min, AI endpoints 25–30/min. (Production should move these to Redis so limits hold across
  instances.)
* Errors are human-readable and non-leaky; stack traces stay on the server. Server logs record error
  messages and identifiers only — never report content or access codes.
* The service worker never serves cached API responses, preventing stale data from being mistaken for
  a server-confirmed state.

## 7. Secrets management

* `DATABASE_URL` and `SAUTILINK_SECRET` come from the environment. `.env` is not committed and no key
  is hard-coded anywhere in the repository.
* Rotating `SAUTILINK_SECRET` invalidates all sessions — the intended emergency action.

## 8. Audit logging

`audit_logs` captures actor, role, action, target and metadata for: sign-in, case updates,
institution messages, category/source/institution/user administration and moderation decisions.
Audit entries never contain reporter identity or access codes.

## 9. Threat considerations

| Threat | Mitigation |
| --- | --- |
| Case-ID guessing | Random IDs **and** a separate hashed access code; read attempts rate-limited |
| Reporter de-anonymisation by staff | No identity stored for anonymous cases; UI and API only ever expose “Anonymous reporter” |
| Cross-institution snooping | Institution scope checked against the database on every read and write |
| Mass false reporting | Rate limiting, moderation review queue, corroboration thresholds before a signal escalates |
| Defamation / inflammatory reports | De-escalation guidance, careful “community reports indicate” language, sensitive categories excluded from public data, admin moderation |
| AI hallucination | Deterministic engine that can only reference configured records; explicit “I couldn't verify this” fallback |
| Stale-data deception | API responses never cached; offline states clearly labelled |

## 10. Known limitations (prototype honesty)

1. **Network metadata** — the hosting provider and any intermediary can observe IP addresses.
   SautiLink does not store IPs against cases, but it cannot prevent network-level observation. Users
   at high risk should use a trusted network or a future Tor/USSD channel.
2. **Evidence at rest** — stored as compressed data URLs in PostgreSQL, protected by database access
   control rather than an encrypted object store with signed URLs. This is the first hardening step
   for a real pilot.
3. **Rate limiting is in-memory** — resets on restart and is per-instance.
4. **Access-code recovery is impossible by design** — a lost code means a lost thread; a future
   optional "recovery passphrase" would trade some privacy for resilience.
5. **No end-to-end encryption** — institution staff and the platform operator can read case content.
   The trust model assumes a vetted institutional operator and an audit log, not zero trust.
6. **SMS fallback is a labelled prototype** — no real messages are transmitted; the endpoint mirrors
   a gateway webhook so the integration is configuration, not a rewrite.
7. **Demonstration dataset** — all people, contacts, institutions and cases in the seed are fictional
   and flagged `demo_data`.
