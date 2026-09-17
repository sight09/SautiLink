import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * SautiLink relational schema.
 *
 * Privacy note: identity data (users) is deliberately kept in a separate table
 * from case content. Anonymous cases store NO link to a user row; they are
 * accessed only with a public case id + hashed access code.
 */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    // citizen | institution | admin
    role: text("role").notNull().default("citizen"),
    institutionId: integer("institution_id"),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const institutions = pgTable("institutions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  type: text("type").notNull(),
  country: text("country").notNull().default("Kenya"),
  region: text("region").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // category slugs this institution handles
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  areas: jsonb("areas").$type<string[]>().notNull().default([]),
  slaHours: integer("sla_hours").notNull().default(72),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameSw: text("name_sw").notNull(),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionSw: text("description_sw").notNull().default(""),
    icon: text("icon").notNull().default("📌"),
    sensitive: boolean("sensitive").notNull().default(false),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("categories_slug_unique").on(t.slug)],
);

export const cases = pgTable(
  "cases",
  {
    id: serial("id").primaryKey(),
    publicCaseId: text("public_case_id").notNull(),
    accessCodeHash: text("access_code_hash").notNull(),
    categorySlug: text("category_slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    summary: text("summary").notNull().default(""),
    language: text("language").notNull().default("en"),
    // low | medium | high | critical
    priority: text("priority").notNull().default("medium"),
    aiPriority: text("ai_priority"),
    aiCategorySlug: text("ai_category_slug"),
    aiConfidence: integer("ai_confidence").notNull().default(0),
    aiInstitutionScore: integer("ai_institution_score").notNull().default(0),
    aiNotes: jsonb("ai_notes").$type<string[]>().notNull().default([]),
    // draft | submitted | under_review | info_needed | responded | in_progress | resolved | closed
    status: text("status").notNull().default("submitted"),
    // community_reported | evidence_submitted | community_corroborated | institution_responded | verified
    trustLevel: text("trust_level").notNull().default("community_reported"),
    anonymous: boolean("anonymous").notNull().default(true),
    reporterUserId: integer("reporter_user_id"),
    // contact provided only for identified reports
    reporterContact: text("reporter_contact"),
    areaName: text("area_name").notNull(),
    locationNote: text("location_note").notNull().default(""),
    institutionId: integer("institution_id"),
    assignedTo: text("assigned_to"),
    channel: text("channel").notNull().default("web"),
    demoData: boolean("demo_data").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("cases_public_id_unique").on(t.publicCaseId),
    index("cases_category_idx").on(t.categorySlug),
    index("cases_status_idx").on(t.status),
    index("cases_institution_idx").on(t.institutionId),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").notNull(),
    // photo | document | audio | note
    type: text("type").notNull(),
    label: text("label").notNull(),
    // data reference: for the PoC we store a compressed data URL or a note
    storageRef: text("storage_ref").notNull().default(""),
    sizeBytes: integer("size_bytes").notNull().default(0),
    private: boolean("private").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_case_idx").on(t.caseId)],
);

export const caseMessages = pgTable(
  "case_messages",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").notNull(),
    // reporter | institution | system
    senderType: text("sender_type").notNull(),
    senderLabel: text("sender_label").notNull(),
    body: text("body").notNull(),
    readByReporter: boolean("read_by_reporter").notNull().default(false),
    readByInstitution: boolean("read_by_institution").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_messages_case_idx").on(t.caseId)],
);

export const caseStatusHistory = pgTable(
  "case_status_history",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").notNull(),
    status: text("status").notNull(),
    actorType: text("actor_type").notNull().default("system"),
    actorLabel: text("actor_label").notNull().default("SautiLink"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_status_case_idx").on(t.caseId)],
);

export const caseNotes = pgTable(
  "case_notes",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id").notNull(),
    authorLabel: text("author_label").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_notes_case_idx").on(t.caseId)],
);

export const communitySignals = pgTable("community_signals", {
  id: serial("id").primaryKey(),
  categorySlug: text("category_slug").notNull(),
  areaName: text("area_name").notNull(),
  titleEn: text("title_en").notNull(),
  titleSw: text("title_sw").notNull(),
  reportCount: integer("report_count").notNull().default(1),
  trendPercent: integer("trend_percent").notNull().default(0),
  status: text("status").notNull().default("community_reported"),
  firstReportedAt: timestamp("first_reported_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trustedSources = pgTable("trusted_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organisation: text("organisation").notNull(),
  reference: text("reference").notNull(),
  language: text("language").notNull().default("en"),
  categorySlug: text("category_slug").notNull().default("general"),
  summaryEn: text("summary_en").notNull(),
  summarySw: text("summary_sw").notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("verified"),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id"),
    userId: integer("user_id"),
    audience: text("audience").notNull().default("reporter"),
    type: text("type").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_case_idx").on(t.caseId)],
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorLabel: text("actor_label").notNull(),
  actorRole: text("actor_role").notNull().default("system"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smsInbox = pgTable("sms_inbox", {
  id: serial("id").primaryKey(),
  fromMasked: text("from_masked").notNull(),
  body: text("body").notNull(),
  parsedCategory: text("parsed_category"),
  createdCaseId: text("created_case_id"),
  simulated: boolean("simulated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaseRow = typeof cases.$inferSelect;
export type InstitutionRow = typeof institutions.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type MessageRow = typeof caseMessages.$inferSelect;
export type EvidenceRow = typeof evidence.$inferSelect;
export type StatusRow = typeof caseStatusHistory.$inferSelect;
export type SignalRow = typeof communitySignals.$inferSelect;
export type SourceRow = typeof trustedSources.$inferSelect;
