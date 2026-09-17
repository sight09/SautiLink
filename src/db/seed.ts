import "dotenv/config";
import { db, pool } from "./index";
import {
  auditLogs,
  caseMessages,
  caseNotes,
  caseStatusHistory,
  cases,
  categories,
  communitySignals,
  evidence,
  institutions,
  notifications,
  smsInbox,
  trustedSources,
  users,
} from "./schema";
import { hashSecret } from "../lib/security";

/**
 * Seeds a realistic pilot dataset (Nairobi County context).
 * All people, contacts and narratives are fictional demonstration data.
 */

const DEMO_ACCESS_CODE = "DEMO12";
const FEATURED_CASE_ID = "CS-82A91-K7X";
const FEATURED_ACCESS_CODE = "SAUTI1";

const AREAS = [
  "Kibera, Nairobi",
  "Mathare, Nairobi",
  "Embakasi East, Nairobi",
  "Kawangware, Nairobi",
  "Dandora, Nairobi",
];

function daysAgo(days: number, hours = 0): Date {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

async function main() {
  console.log("Clearing existing SautiLink data…");
  await db.delete(auditLogs);
  await db.delete(notifications);
  await db.delete(caseNotes);
  await db.delete(caseStatusHistory);
  await db.delete(caseMessages);
  await db.delete(evidence);
  await db.delete(cases);
  await db.delete(communitySignals);
  await db.delete(trustedSources);
  await db.delete(categories);
  await db.delete(smsInbox);
  await db.delete(users);
  await db.delete(institutions);

  console.log("Seeding categories…");
  const categoryRows = await db
    .insert(categories)
    .values([
      {
        slug: "water",
        nameEn: "Water & sanitation",
        nameSw: "Maji na usafi",
        descriptionEn: "No water, dirty water, burst pipes, sewage.",
        descriptionSw: "Ukosefu wa maji, maji machafu, mabomba, maji taka.",
        icon: "💧",
        keywords: ["water", "tap", "pipe", "borehole", "sewage", "maji", "bomba", "maji taka"],
        sortOrder: 1,
      },
      {
        slug: "roads",
        nameEn: "Roads & infrastructure",
        nameSw: "Barabara na miundombinu",
        descriptionEn: "Potholes, streetlights, drainage, bridges.",
        descriptionSw: "Mashimo, taa za barabarani, mifereji, madaraja.",
        icon: "🛣️",
        keywords: ["road", "pothole", "streetlight", "bridge", "drainage", "barabara", "shimo", "taa"],
        sortOrder: 2,
      },
      {
        slug: "health",
        nameEn: "Healthcare",
        nameSw: "Afya",
        descriptionEn: "Clinics, medicine stock-outs, staff absence.",
        descriptionSw: "Zahanati, ukosefu wa dawa, wahudumu.",
        icon: "🏥",
        keywords: ["clinic", "hospital", "medicine", "nurse", "doctor", "hospitali", "dawa", "zahanati"],
        sortOrder: 3,
      },
      {
        slug: "education",
        nameEn: "Education",
        nameSw: "Elimu",
        descriptionEn: "School facilities, fees, teacher absence.",
        descriptionSw: "Vifaa vya shule, ada, ukosefu wa walimu.",
        icon: "📚",
        keywords: ["school", "teacher", "classroom", "fees", "shule", "mwalimu", "darasa"],
        sortOrder: 4,
      },
      {
        slug: "public-facility",
        nameEn: "Public facilities",
        nameSw: "Vituo vya umma",
        descriptionEn: "Markets, toilets, community halls, waste.",
        descriptionSw: "Masoko, vyoo, kumbi, taka.",
        icon: "🏢",
        keywords: ["market", "toilet", "garbage", "waste", "soko", "choo", "taka"],
        sortOrder: 5,
      },
      {
        slug: "safety",
        nameEn: "Safety & security",
        nameSw: "Usalama",
        descriptionEn: "Unsafe areas, crime risk, hazards.",
        descriptionSw: "Maeneo hatari, uhalifu, hatari.",
        icon: "🛡️",
        keywords: ["unsafe", "crime", "robbery", "danger", "hatari", "usalama", "wizi"],
        sensitive: true,
        sortOrder: 6,
      },
      {
        slug: "protection",
        nameEn: "Abuse or violence",
        nameSw: "Unyanyasaji au vurugu",
        descriptionEn: "Handled with extra privacy safeguards.",
        descriptionSw: "Hushughulikiwa kwa ulinzi wa ziada wa faragha.",
        icon: "🤝",
        keywords: ["abuse", "violence", "assault", "harassment", "unyanyasaji", "vurugu"],
        sensitive: true,
        sortOrder: 7,
      },
      {
        slug: "environment",
        nameEn: "Environment",
        nameSw: "Mazingira",
        descriptionEn: "Pollution, dumping, flooding.",
        descriptionSw: "Uchafuzi, utupaji taka, mafuriko.",
        icon: "🌿",
        keywords: ["pollution", "dumping", "flood", "smoke", "mafuriko", "uchafuzi"],
        sortOrder: 8,
      },
      {
        slug: "cohesion",
        nameEn: "Community conflict",
        nameSw: "Mgogoro wa jamii",
        descriptionEn: "Shared-resource disputes and mediation.",
        descriptionSw: "Migogoro ya rasilimali na upatanishi.",
        icon: "🕊️",
        keywords: ["conflict", "dispute", "fight", "tension", "mgogoro", "ugomvi"],
        sensitive: true,
        sortOrder: 9,
      },
      {
        slug: "other",
        nameEn: "Something else",
        nameSw: "Jambo lingine",
        descriptionEn: "Not sure which category fits.",
        descriptionSw: "Huna uhakika ni kundi gani.",
        icon: "📌",
        keywords: [],
        sortOrder: 10,
      },
    ])
    .returning();
  console.log(`  ${categoryRows.length} categories`);

  console.log("Seeding institutions…");
  const institutionRows = await db
    .insert(institutions)
    .values([
      {
        name: "Nairobi Metropolitan Water & Sewerage Services",
        shortName: "NMWSS",
        type: "utility",
        country: "Kenya",
        region: "Nairobi County",
        contactEmail: "care@nmwss.demo.go.ke",
        contactPhone: "+254 700 000 101",
        categories: ["water", "environment"],
        areas: AREAS,
        slaHours: 48,
      },
      {
        name: "Nairobi County Roads & Public Works",
        shortName: "NC Roads",
        type: "county-department",
        country: "Kenya",
        region: "Nairobi County",
        contactEmail: "roads@nairobi.demo.go.ke",
        contactPhone: "+254 700 000 102",
        categories: ["roads", "public-facility"],
        areas: AREAS,
        slaHours: 96,
      },
      {
        name: "County Department of Health Services",
        shortName: "County Health",
        type: "county-department",
        country: "Kenya",
        region: "Nairobi County",
        contactEmail: "health@nairobi.demo.go.ke",
        contactPhone: "+254 700 000 103",
        categories: ["health", "protection"],
        areas: AREAS,
        slaHours: 24,
      },
      {
        name: "Sub-County Education Office",
        shortName: "Education Office",
        type: "national-agency",
        country: "Kenya",
        region: "Nairobi County",
        contactEmail: "education@demo.go.ke",
        contactPhone: "+254 700 000 104",
        categories: ["education"],
        areas: AREAS,
        slaHours: 120,
      },
      {
        name: "Community Safety & Mediation Desk",
        shortName: "Safety Desk",
        type: "community-partner",
        country: "Kenya",
        region: "Nairobi County",
        contactEmail: "safety@demo.or.ke",
        contactPhone: "+254 700 000 105",
        categories: ["safety", "cohesion", "protection"],
        areas: AREAS,
        slaHours: 12,
      },
    ])
    .returning();
  const water = institutionRows[0];
  const roads = institutionRows[1];
  const health = institutionRows[2];
  const education = institutionRows[3];
  const safety = institutionRows[4];

  console.log("Seeding users…");
  const password = hashSecret("Demo1234!");
  await db.insert(users).values([
    { name: "Amina Wanjiru", email: "citizen@sautilink.demo", passwordHash: password, role: "citizen", language: "sw" },
    {
      name: "Joseph Otieno",
      email: "water@sautilink.demo",
      passwordHash: password,
      role: "institution",
      institutionId: water.id,
    },
    {
      name: "Grace Kilonzo",
      email: "roads@sautilink.demo",
      passwordHash: password,
      role: "institution",
      institutionId: roads.id,
    },
    { name: "Platform Admin", email: "admin@sautilink.demo", passwordHash: password, role: "admin" },
  ]);

  console.log("Seeding trusted sources…");
  await db.insert(trustedSources).values([
    {
      name: "Reporting a water supply interruption",
      organisation: "Nairobi Metropolitan Water & Sewerage Services",
      reference: "Customer Service Charter §4 (demo copy)",
      categorySlug: "water",
      summaryEn:
        "Report interruptions with your area name, the date supply stopped and the nearest landmark. The utility aims to acknowledge within 48 hours and to publish a restoration plan for outages longer than 72 hours. No payment is required to report a fault.",
      summarySw:
        "Ripoti kukatika kwa maji ukitaja eneo, tarehe maji yalipokatika na alama ya karibu. Shirika hulenga kujibu ndani ya saa 48 na kutoa mpango wa kurejesha huduma kwa zaidi ya saa 72. Hakuna malipo yanayohitajika kuripoti hitilafu.",
      keywords: ["water", "no water", "tap", "supply", "maji", "bomba"],
      lastVerifiedAt: daysAgo(12),
    },
    {
      name: "Street lighting and pothole repair requests",
      organisation: "Nairobi County Roads & Public Works",
      reference: "County Service Guide, Roads (demo copy)",
      categorySlug: "roads",
      summaryEn:
        "Road defects and non-functioning street lights are logged with a ward reference. Include a photo, the road name and whether the defect is causing an immediate hazard. Hazardous defects are prioritised for temporary make-safe works.",
      summarySw:
        "Hitilafu za barabara na taa zisizofanya kazi husajiliwa kwa kumbukumbu ya wadi. Ambatisha picha, jina la barabara na kama hatari ni ya haraka.",
      keywords: ["road", "pothole", "streetlight", "barabara", "taa", "shimo"],
      lastVerifiedAt: daysAgo(20),
    },
    {
      name: "Free primary healthcare entitlements",
      organisation: "County Department of Health Services",
      reference: "Public Health Facility Charter (demo copy)",
      categorySlug: "health",
      summaryEn:
        "Consultation at a public dispensary is free. If you are asked to pay for a free service, or if essential medicines are out of stock, this can be reported and the facility must respond. Keep any receipt or reference number you were given.",
      summarySw:
        "Ushauri katika zahanati ya umma ni bure. Ukiombwa kulipa huduma ya bure, au dawa muhimu zikikosekana, unaweza kuripoti na kituo lazima kijibu.",
      keywords: ["health", "clinic", "medicine", "free", "hospitali", "dawa"],
      lastVerifiedAt: daysAgo(9),
    },
    {
      name: "Protection reporting and confidentiality",
      organisation: "Community Safety & Mediation Desk",
      reference: "Survivor-centred reporting protocol (demo copy)",
      categorySlug: "protection",
      summaryEn:
        "Reports involving abuse or violence are handled by trained staff only, are never published on public dashboards, and can be made without giving a name. If you are in immediate danger, contact local emergency services first.",
      summarySw:
        "Ripoti za unyanyasaji hushughulikiwa na wafanyakazi waliofunzwa pekee, haziwekwi hadharani, na zinaweza kutolewa bila jina. Ukiwa hatarini sasa, wasiliana na huduma za dharura kwanza.",
      keywords: ["abuse", "violence", "protection", "confidential", "unyanyasaji"],
      lastVerifiedAt: daysAgo(4),
    },
    {
      name: "School facility complaints",
      organisation: "Sub-County Education Office",
      reference: "Education service desk guide (demo copy)",
      categorySlug: "education",
      summaryEn:
        "Complaints about school infrastructure, unlawful levies or prolonged teacher absence are received by the sub-county office, which must acknowledge within five working days.",
      summarySw:
        "Malalamiko kuhusu miundombinu ya shule, ada zisizo halali au kutokuwepo kwa walimu hupokelewa na ofisi ya kaunti ndogo, ambayo lazima ijibu ndani ya siku tano za kazi.",
      keywords: ["school", "education", "teacher", "fees", "shule", "elimu"],
      lastVerifiedAt: daysAgo(26),
    },
  ]);

  console.log("Seeding cases…");
  const demoHash = hashSecret(DEMO_ACCESS_CODE);
  const featuredHash = hashSecret(FEATURED_ACCESS_CODE);

  type Template = {
    category: string;
    institutionId: number;
    titles: string[];
    descriptions: string[];
    total: number;
    area: string;
  };

  const templates: Template[] = [
    {
      category: "water",
      institutionId: water.id,
      area: "Kibera, Nairobi",
      total: 47,
      titles: [
        "No piped water for two weeks",
        "Communal tap dry since Monday",
        "Burst pipe near the market",
        "Water available only at night",
        "Brown water from the standpipe",
      ],
      descriptions: [
        "There has been no water in our neighbourhood for two weeks. Families are buying from vendors at four times the normal price.",
        "The communal tap near the northern entrance has been dry since Monday. Around forty households use it.",
        "A pipe burst beside the market walkway three days ago and is still leaking. Children walk through the water.",
        "Water only comes between midnight and 3am, which is unsafe for women and older people collecting it.",
        "Water from the standpipe is brown and has a smell. We have stopped drinking it but still use it for washing.",
      ],
    },
    {
      category: "roads",
      institutionId: roads.id,
      area: "Mathare, Nairobi",
      total: 31,
      titles: [
        "Street lights out on the main path",
        "Deep pothole flooding the walkway",
        "Open drainage beside footpath",
        "Broken culvert at the junction",
      ],
      descriptions: [
        "All street lights along the main path have been off for a month. The route is unsafe after dark.",
        "A deep pothole fills with water and blocks the walkway. Boda riders have fallen twice this week.",
        "The drainage channel beside the footpath is open and unmarked, close to where children walk to school.",
        "The culvert at the junction collapsed after the rains and traffic now uses the pedestrian side.",
      ],
    },
    {
      category: "health",
      institutionId: health.id,
      area: "Embakasi East, Nairobi",
      total: 19,
      titles: [
        "Dispensary out of essential medicine",
        "Clinic closed during posted hours",
        "Long waits with no triage",
      ],
      descriptions: [
        "The dispensary has had no stock of basic malaria medicine for ten days and refers everyone to private chemists.",
        "The clinic was closed during posted opening hours on three separate days this week.",
        "Patients wait more than five hours with no triage. Elderly patients are waiting outside in the sun.",
      ],
    },
    {
      category: "education",
      institutionId: education.id,
      area: "Kawangware, Nairobi",
      total: 14,
      titles: ["Classroom roof leaking", "Unlawful levy requested", "No usable toilets at school"],
      descriptions: [
        "Two classroom roofs leak badly and pupils are sent home whenever it rains.",
        "Parents were asked to pay an extra levy that is not on the published fee structure.",
        "The school toilets have been out of use for a month and pupils are using the open field.",
      ],
    },
    {
      category: "public-facility",
      institutionId: roads.id,
      area: "Dandora, Nairobi",
      total: 11,
      titles: ["Uncollected waste at market", "Community hall unusable"],
      descriptions: [
        "Waste has not been collected from the market area for two weeks and is now blocking a walkway.",
        "The community hall roof is damaged and the space cannot be used for meetings.",
      ],
    },
    {
      category: "safety",
      institutionId: safety.id,
      area: "Mathare, Nairobi",
      total: 9,
      titles: ["Unsafe crossing near school", "Unlit alley used as shortcut"],
      descriptions: [
        "Vehicles do not slow down at the crossing children use in the morning. There are no markings.",
        "The alley used as a shortcut has no lighting and residents avoid it after 7pm.",
      ],
    },
    {
      category: "environment",
      institutionId: water.id,
      area: "Kibera, Nairobi",
      total: 8,
      titles: ["Illegal dumping beside the river", "Flooding after short rains"],
      descriptions: [
        "Lorries dump construction waste beside the river at night and the channel is now blocked.",
        "Short rains flood the lower lane because the drainage is blocked with silt.",
      ],
    },
  ];

  const statusCycle = [
    { status: "submitted", trust: "community_reported" },
    { status: "under_review", trust: "community_reported" },
    { status: "info_needed", trust: "evidence_submitted" },
    { status: "responded", trust: "institution_responded" },
    { status: "in_progress", trust: "institution_responded" },
    { status: "resolved", trust: "verified" },
    { status: "closed", trust: "institution_responded" },
  ];

  let serial = 0;
  const bulkValues: (typeof cases.$inferInsert)[] = [];
  for (const template of templates) {
    for (let i = 0; i < template.total; i += 1) {
      serial += 1;
      const cycle = statusCycle[(i * 3 + serial) % statusCycle.length];
      const created = daysAgo((i % 21) + 1, i % 20);
      const titleIndex = i % template.titles.length;
      bulkValues.push({
        publicCaseId: `CS-${String(10000 + serial * 7).slice(0, 5)}-${String.fromCharCode(65 + (serial % 26))}${String.fromCharCode(65 + ((serial * 3) % 26))}${(serial % 10)}`,
        accessCodeHash: demoHash,
        categorySlug: template.category,
        title: template.titles[titleIndex],
        description: template.descriptions[titleIndex],
        summary: template.descriptions[titleIndex].slice(0, 160),
        language: i % 5 === 0 ? "sw" : "en",
        priority: i % 9 === 0 ? "critical" : i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
        aiPriority: i % 3 === 0 ? "high" : "medium",
        aiCategorySlug: template.category,
        aiConfidence: 68 + (i % 25),
        aiInstitutionScore: 72 + (i % 22),
        aiNotes: ["Seeded demonstration case."],
        status: cycle.status,
        trustLevel: template.total >= 20 ? "community_corroborated" : cycle.trust,
        anonymous: i % 3 !== 0,
        areaName: template.area,
        locationNote: "Approximate location shared by reporter",
        institutionId: template.institutionId,
        channel: i % 11 === 0 ? "sms-prototype" : "web",
        demoData: true,
        createdAt: created,
        updatedAt: daysAgo((i % 5) + 0.2),
        resolvedAt: cycle.status === "resolved" ? daysAgo(i % 4) : null,
      });
    }
  }
  const inserted = await db.insert(cases).values(bulkValues).returning({ id: cases.id, status: cases.status, createdAt: cases.createdAt, institutionId: cases.institutionId });
  console.log(`  ${inserted.length} community cases`);

  // Lightweight history for bulk cases so timelines are never empty.
  await db.insert(caseStatusHistory).values(
    inserted.flatMap((row) => {
      const entries = [
        {
          caseId: row.id,
          status: "submitted",
          actorType: "reporter",
          actorLabel: "Community reporter",
          note: "Report received by SautiLink.",
          createdAt: row.createdAt,
        },
      ];
      if (row.status !== "submitted") {
        entries.push({
          caseId: row.id,
          status: row.status,
          actorType: "institution",
          actorLabel: "Institution case desk",
          note: "Status updated by the handling institution.",
          createdAt: new Date(new Date(row.createdAt).getTime() + 86_400_000),
        });
      }
      return entries;
    }),
  );

  console.log("Seeding featured demo case…");
  const [featured] = await db
    .insert(cases)
    .values({
      publicCaseId: FEATURED_CASE_ID,
      accessCodeHash: featuredHash,
      categorySlug: "water",
      title: "No piped water in our neighbourhood for two weeks",
      description:
        "There has been no water in our neighbourhood for two weeks. The communal tap near the northern entrance is completely dry and families are buying water from vendors at four times the usual price. Older residents cannot carry water from the next estate.",
      summary:
        "Two-week piped water outage affecting a densely populated area; communal tap dry, households paying vendor prices.",
      language: "en",
      priority: "high",
      aiPriority: "high",
      aiCategorySlug: "water",
      aiConfidence: 92,
      aiInstitutionScore: 87,
      aiNotes: [
        "Category suggested from terms: water, tap, two weeks.",
        "Urgency: Mentions prolonged disruption affecting households (\"two weeks\").",
        "Institution match 87% — Handles this issue category; Operates in the reported area.",
        "47 report(s) may describe a similar issue in Kibera, Nairobi.",
      ],
      status: "info_needed",
      trustLevel: "community_corroborated",
      anonymous: true,
      areaName: "Kibera, Nairobi",
      locationNote: "Approximate location: northern side of the settlement",
      institutionId: water.id,
      assignedTo: "Distribution Team B",
      demoData: true,
      createdAt: daysAgo(3, 5),
      updatedAt: daysAgo(0, 4),
    })
    .returning();

  await db.insert(evidence).values([
    {
      caseId: featured.id,
      type: "photo",
      label: "Dry communal tap (photo described by reporter)",
      storageRef: "",
      sizeBytes: 184_320,
    },
    {
      caseId: featured.id,
      type: "note",
      label: "Vendor price note: 20L jerrycan at 4x normal price",
      storageRef: "",
      sizeBytes: 0,
    },
  ]);

  await db.insert(caseStatusHistory).values([
    {
      caseId: featured.id,
      status: "submitted",
      actorType: "reporter",
      actorLabel: "Anonymous reporter",
      note: "Report received by SautiLink.",
      createdAt: daysAgo(3, 5),
    },
    {
      caseId: featured.id,
      status: "submitted",
      actorType: "system",
      actorLabel: "SautiLink civic engine",
      note: "AI-assisted classification: water · urgency high (92% confidence).",
      createdAt: daysAgo(3, 5),
    },
    {
      caseId: featured.id,
      status: "submitted",
      actorType: "system",
      actorLabel: "SautiLink",
      note: "2 evidence item(s) received.",
      createdAt: daysAgo(3, 4),
    },
    {
      caseId: featured.id,
      status: "under_review",
      actorType: "system",
      actorLabel: "SautiLink",
      note: "Nairobi Metropolitan Water & Sewerage Services notified (match 87%).",
      createdAt: daysAgo(3, 3),
    },
    {
      caseId: featured.id,
      status: "under_review",
      actorType: "institution",
      actorLabel: "NMWSS case desk",
      note: "Case acknowledged and assigned to Distribution Team B.",
      createdAt: daysAgo(2, 2),
    },
    {
      caseId: featured.id,
      status: "info_needed",
      actorType: "institution",
      actorLabel: "NMWSS case desk",
      note: "Additional location detail requested from the reporter.",
      createdAt: daysAgo(1, 1),
    },
  ]);

  await db.insert(caseMessages).values([
    {
      caseId: featured.id,
      senderType: "institution",
      senderLabel: "NMWSS case desk",
      body: "Thank you for the report. We have logged it as a supply interruption. To dispatch the right crew we need a more precise description of the location — which tap or line is affected, and is the whole lane dry or only some households?",
      readByInstitution: true,
      createdAt: daysAgo(1, 1),
    },
  ]);

  await db.insert(caseNotes).values({
    caseId: featured.id,
    authorLabel: "Joseph Otieno",
    body: "Pressure logs show a drop on the northern line from the 9th. Awaiting reporter confirmation before dispatching a crew.",
    createdAt: daysAgo(1),
  });

  await db.insert(notifications).values([
    {
      caseId: featured.id,
      audience: "reporter",
      type: "case_created",
      message: `Your case ${FEATURED_CASE_ID} has been received and routed to NMWSS.`,
      createdAt: daysAgo(3, 5),
    },
    {
      caseId: featured.id,
      audience: "reporter",
      type: "info_needed",
      message: "An institution requested more information about your case.",
      createdAt: daysAgo(1, 1),
    },
  ]);

  // A fully resolved showcase case so the resolution journey is visible immediately.
  const [resolvedCase] = await db
    .insert(cases)
    .values({
      publicCaseId: "CS-4K7TD-M2P",
      accessCodeHash: demoHash,
      categorySlug: "roads",
      title: "Street lights out along the main path",
      description:
        "All street lights along the main path have been off for a month, making the route unsafe after dark for people returning from work.",
      summary: "Month-long street lighting failure on a main pedestrian route.",
      priority: "high",
      aiPriority: "high",
      aiCategorySlug: "roads",
      aiConfidence: 88,
      aiInstitutionScore: 91,
      aiNotes: ["Seeded demonstration case with a completed resolution journey."],
      status: "resolved",
      trustLevel: "verified",
      anonymous: true,
      areaName: "Mathare, Nairobi",
      locationNote: "Main path between the two markets",
      institutionId: roads.id,
      assignedTo: "Lighting Crew 2",
      demoData: true,
      createdAt: daysAgo(24),
      updatedAt: daysAgo(2),
      resolvedAt: daysAgo(2),
    })
    .returning();

  await db.insert(caseStatusHistory).values([
    { caseId: resolvedCase.id, status: "submitted", actorType: "reporter", actorLabel: "Anonymous reporter", note: "Report received by SautiLink.", createdAt: daysAgo(24) },
    { caseId: resolvedCase.id, status: "under_review", actorType: "institution", actorLabel: "NC Roads case desk", note: "Case acknowledged; ward reference LGT-1182 created.", createdAt: daysAgo(22) },
    { caseId: resolvedCase.id, status: "info_needed", actorType: "institution", actorLabel: "NC Roads case desk", note: "Asked reporter to confirm the number of affected poles.", createdAt: daysAgo(19) },
    { caseId: resolvedCase.id, status: "responded", actorType: "institution", actorLabel: "NC Roads case desk", note: "Six poles confirmed faulty; materials requisitioned.", createdAt: daysAgo(14) },
    { caseId: resolvedCase.id, status: "in_progress", actorType: "institution", actorLabel: "Lighting Crew 2", note: "Crew on site replacing faulty fittings.", createdAt: daysAgo(6) },
    { caseId: resolvedCase.id, status: "resolved", actorType: "institution", actorLabel: "NC Roads case desk", note: "All six lights restored and tested on site. Ward office informed.", createdAt: daysAgo(2) },
  ]);

  await db.insert(caseMessages).values([
    { caseId: resolvedCase.id, senderType: "institution", senderLabel: "NC Roads case desk", body: "Could you confirm roughly how many poles are affected along the path?", readByInstitution: true, readByReporter: true, createdAt: daysAgo(19) },
    { caseId: resolvedCase.id, senderType: "reporter", senderLabel: "Anonymous reporter", body: "About six poles, from the shop at the corner up to the footbridge.", readByInstitution: true, readByReporter: true, createdAt: daysAgo(18) },
    { caseId: resolvedCase.id, senderType: "institution", senderLabel: "NC Roads case desk", body: "Thank you. Work order raised. Replacement fittings arrive next week and the crew will attend.", readByInstitution: true, readByReporter: true, createdAt: daysAgo(14) },
  ]);

  console.log("Seeding community signals…");
  await db.insert(communitySignals).values([
    { categorySlug: "water", areaName: "Kibera, Nairobi", titleEn: "Water supply disruption", titleSw: "Kukatika kwa huduma ya maji", reportCount: 48, trendPercent: 63, status: "community_corroborated", firstReportedAt: daysAgo(12) },
    { categorySlug: "roads", areaName: "Mathare, Nairobi", titleEn: "Street lighting and road safety", titleSw: "Taa za barabarani na usalama", reportCount: 31, trendPercent: 18, status: "institution_responded", firstReportedAt: daysAgo(26) },
    { categorySlug: "health", areaName: "Embakasi East, Nairobi", titleEn: "Medicine stock-outs", titleSw: "Ukosefu wa dawa", reportCount: 19, trendPercent: 27, status: "community_corroborated", firstReportedAt: daysAgo(16) },
    { categorySlug: "education", areaName: "Kawangware, Nairobi", titleEn: "School facility conditions", titleSw: "Hali ya vifaa vya shule", reportCount: 14, trendPercent: -8, status: "community_reported", firstReportedAt: daysAgo(30) },
    { categorySlug: "public-facility", areaName: "Dandora, Nairobi", titleEn: "Waste collection gaps", titleSw: "Ukosefu wa ukusanyaji taka", reportCount: 11, trendPercent: 12, status: "community_reported", firstReportedAt: daysAgo(18) },
  ]);

  console.log("Seeding SMS fallback prototype inbox…");
  await db.insert(smsInbox).values([
    { fromMasked: "+2547•••••412", body: "MAJI Kibera hakuna maji siku 14 karibu na lango la kaskazini", parsedCategory: "water", simulated: true, createdAt: daysAgo(2) },
    { fromMasked: "+2547•••••883", body: "ROAD Mathare streetlights off main path one month", parsedCategory: "roads", simulated: true, createdAt: daysAgo(5) },
  ]);

  await db.insert(auditLogs).values([
    { actorLabel: "Platform Admin", actorRole: "admin", action: "seed.dataset.loaded", target: "demo-dataset", meta: { cases: inserted.length + 2 } },
    { actorLabel: "Platform Admin", actorRole: "admin", action: "source.verified", target: "Reporting a water supply interruption", meta: {} },
  ]);

  console.log("\nSeed complete.");
  console.log(`  Featured case: ${FEATURED_CASE_ID} / access code ${FEATURED_ACCESS_CODE}`);
  console.log(`  Demo case access code for seeded cases: ${DEMO_ACCESS_CODE}`);
  console.log("  Logins (password Demo1234!): citizen@sautilink.demo, water@sautilink.demo, admin@sautilink.demo");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
