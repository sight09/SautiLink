#!/usr/bin/env node
/**
 * SautiLink end-to-end API + authorisation suite.
 * Usage: node tests/smoke.mjs [baseUrl]     (server must already be running)
 */

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body, headers: response.headers };
}

async function main() {
  console.log(`SautiLink smoke suite → ${BASE}\n`);

  console.log("Health");
  const health = await req("/api/health");
  check("health endpoint returns ok", health.status === 200 && health.body?.ok === true);

  console.log("\nValidation");
  const short = await req("/api/cases", {
    method: "POST",
    body: JSON.stringify({ categorySlug: "water", description: "short", areaName: "Kibera, Nairobi", anonymous: true }),
  });
  check("rejects too-short descriptions", short.status === 400, `got ${short.status}`);
  check("validation error is human readable", typeof short.body?.error === "string" && !short.body.error.includes("ZodError"));

  console.log("\nAnonymous reporting");
  const created = await req("/api/cases", {
    method: "POST",
    body: JSON.stringify({
      categorySlug: "water",
      description: "Automated test: there has been no water in our neighbourhood for two weeks and the communal tap is dry.",
      areaName: "Kibera, Nairobi",
      anonymous: true,
      language: "en",
      evidence: [{ type: "note", label: "test evidence note" }],
    }),
  });
  check("creates a case", created.status === 201, `got ${created.status}`);
  const caseId = created.body?.publicCaseId;
  const accessCode = created.body?.accessCode;
  check("issues a Case ID in CS-XXXXX-XXX form", /^CS-[A-Z0-9]{5}-[A-Z0-9]{3}$/.test(caseId ?? ""), caseId);
  check("issues a 6-character access code", /^[A-Z0-9]{6}$/.test(accessCode ?? ""));
  check("returns an AI-assisted classification", typeof created.body?.ai?.confidence === "number");
  check("suggests a responsible institution", created.body?.institution?.score > 0);

  console.log("\nCase access control");
  const noCode = await req(`/api/cases/${caseId}`);
  check("denies access without an access code", noCode.status === 403, `got ${noCode.status}`);
  const badCode = await req(`/api/cases/${caseId}?code=WRONG9`);
  check("denies access with a wrong access code", badCode.status === 403);
  const unknown = await req("/api/cases/CS-00000-ZZZ?code=ABCDEF");
  check("unknown Case ID returns a friendly 404", unknown.status === 404 && /couldn't find/i.test(unknown.body?.error ?? ""));
  const ok = await req(`/api/cases/${caseId}?code=${accessCode}`);
  check("grants access with the correct code", ok.status === 200);
  check("never returns the access code hash", ok.body && !("accessCodeHash" in ok.body.case));
  check("anonymous case exposes no reporter contact", ok.body?.case?.reporterContact === null);
  check("timeline is populated", Array.isArray(ok.body?.history) && ok.body.history.length >= 2);

  console.log("\nAnonymous messaging");
  const reporterMsg = await req(`/api/cases/${caseId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "Automated test: the issue is near the northern entrance.", accessCode }),
  });
  check("reporter can message with the access code", reporterMsg.status === 201);
  check("reporter is labelled anonymously", reporterMsg.body?.message?.senderLabel === "Anonymous reporter");
  const forged = await req(`/api/cases/${caseId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "Automated test: forged message", accessCode: "NOPE12" }),
  });
  check("rejects messages with a wrong access code", forged.status === 403);

  console.log("\nAuthorisation");
  const noAuthStatus = await req(`/api/cases/${caseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "resolved" }),
  });
  check("anonymous callers cannot change status", noAuthStatus.status === 401);
  const noAuthAdmin = await req("/api/admin/actions", {
    method: "POST",
    body: JSON.stringify({ action: "source.verify", id: 1 }),
  });
  check("anonymous callers cannot run admin actions", noAuthAdmin.status === 401);
  const badLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "water@sautilink.demo", password: "wrong-password" }),
  });
  check("wrong password is rejected", badLogin.status === 401);
  check("login error does not reveal account existence", /incorrect/i.test(badLogin.body?.error ?? ""));

  console.log("\nInstitution workflow");
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "water@sautilink.demo", password: "Demo1234!" }),
  });
  const cookie = login.headers.getSetCookie?.().join("; ") ?? login.headers.get("set-cookie") ?? "";
  check("institution staff can sign in", login.status === 200 && cookie.includes("sl_session"));

  const authed = (path, options = {}) => req(path, { ...options, headers: { cookie, ...(options.headers ?? {}) } });

  const instRead = await authed(`/api/cases/${caseId}`);
  check("institution can read a case routed to it", instRead.status === 200);
  check("institution view marks the viewer role", instRead.body?.viewer === "institution");

  const requestInfo = await authed(`/api/cases/${caseId}/status`, {
    method: "POST",
    body: JSON.stringify({
      status: "info_needed",
      note: "Automated test: information requested.",
      messageToReporter: "Automated test: which tap is affected?",
    }),
  });
  check("institution can request information", requestInfo.status === 200);

  const resolve = await authed(`/api/cases/${caseId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "resolved", note: "Automated test: resolved on site." }),
  });
  check("institution can resolve a case", resolve.status === 200);

  const after = await req(`/api/cases/${caseId}?code=${accessCode}`);
  check("case status reaches resolved", after.body?.case?.status === "resolved");
  check("trust level escalates to verified", after.body?.case?.trustLevel === "verified");
  check("conversation is visible to the reporter", (after.body?.messages ?? []).length >= 2);
  check("reporter cannot see internal notes", Array.isArray(after.body?.notes) && after.body.notes.length === 0);

  const otherInstitution = await authed("/api/cases/CS-4K7TD-M2P/status", {
    method: "POST",
    body: JSON.stringify({ status: "closed" }),
  });
  check("cross-institution updates are denied", otherInstitution.status === 403, `got ${otherInstitution.status}`);

  console.log("\nCivic AI");
  const classify = await req("/api/ai/classify", {
    method: "POST",
    body: JSON.stringify({
      description: "The communal tap has been dry for two weeks and children are affected.",
      categorySlug: "water",
      areaName: "Kibera, Nairobi",
    }),
  });
  check("classifier returns a category", classify.body?.categorySlug === "water");
  check("classifier escalates urgency with a reason", ["high", "critical"].includes(classify.body?.priority) && Boolean(classify.body?.priorityReason));
  check("classifier finds related reports", classify.body?.relatedCount > 0);

  const deescalate = await req("/api/ai/classify", {
    method: "POST",
    body: JSON.stringify({
      description: "Those people from that tribe are stealing our water every night.",
      categorySlug: "water",
      areaName: "Kibera, Nairobi",
    }),
  });
  check("de-escalation guidance triggers on group blame", typeof deescalate.body?.deEscalation === "string");

  const assistant = await req("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ question: "Can I report anonymously?", language: "en" }),
  });
  check("assistant answers procedural questions", /anonymous/i.test(assistant.body?.answer ?? ""));
  const swahili = await req("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ question: "Je, naweza kuripoti bila kujitambulisha?", language: "sw" }),
  });
  check("assistant answers in Swahili", /ndiyo|ripoti/i.test(swahili.body?.answer ?? ""));
  const unknownQuestion = await req("/api/ai/assistant", {
    method: "POST",
    body: JSON.stringify({ question: "What is the current price of gold on the world market?", language: "en" }),
  });
  check("assistant refuses to guess unverified facts", unknownQuestion.body?.confidence === "unverified");

  console.log("\nSMS fallback prototype");
  const sms = await req("/api/sms/simulate", {
    method: "POST",
    body: JSON.stringify({ from: "+254700999888", body: "MAJI Kibera hakuna maji kwa wiki mbili karibu na lango" }),
  });
  check("prototype creates a case from a simulated SMS", sms.status === 201 && Boolean(sms.body?.publicCaseId));
  check("prototype is clearly labelled", sms.body?.prototype === true && /prototype/i.test(sms.body?.reply ?? ""));

  console.log("\nPublic surfaces");
  for (const path of ["/", "/report", "/cases", "/assistant", "/track", "/services", "/settings", "/transparency", "/login", "/offline"]) {
    const response = await fetch(`${BASE}${path}`);
    check(`${path} renders`, response.status === 200, `got ${response.status}`);
  }
  for (const path of ["/institution", "/admin"]) {
    const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
    check(`${path} is guarded for anonymous users`, response.status === 307 || response.status === 302, `got ${response.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
