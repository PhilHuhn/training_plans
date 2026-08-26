import {
  pgTable,
  serial,
  varchar,
  boolean,
  text,
  integer,
  real,
  doublePrecision,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateJoinCode } from "@/lib/club-codes";

// =====================================================================
// Enums
// =====================================================================

export const raceTypeEnum = pgEnum("race_type", [
  "5K",
  "10K",
  "HM",
  "M",
  "50K",
  "100K",
  "50M",
  "100M",
  "OTHER",
]);

export const racePriorityEnum = pgEnum("race_priority", ["A", "B", "C"]);

export const sessionSourceEnum = pgEnum("session_source", [
  "app_recommendation",
  "uploaded_plan",
  "manual",
  "ics_import",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "planned",
  "completed",
  "skipped",
  "modified",
]);

export const clubPlanTierEnum = pgEnum("club_plan_tier", ["free", "paid"]);

export const clubRoleEnum = pgEnum("club_role", ["coach", "athlete", "captain"]);

export const clubVisibilityEnum = pgEnum("club_visibility", ["typ_only", "full"]);

export const feedbackCategoryEnum = pgEnum("feedback_category", [
  "bug",
  "feature",
  "question",
  "other",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "open",
  "planned",
  "in_progress",
  "done",
  "declined",
]);

// =====================================================================
// Default user preferences (matches FastAPI seed)
// =====================================================================

// Defaults match what calculateHrZonesFromMax(190, 50) and
// calculatePaceZonesFromThreshold(300) produce, so a fresh user's defaults
// transition cleanly to estimated zones (same shape, same keys, same names).
export const DEFAULT_USER_PREFERENCES = {
  units: "metric",
  hr_zones: {
    zone1: { min: 120, max: 134, name: "Active Recovery" },
    zone2: { min: 135, max: 148, name: "Endurance" },
    zone3: { min: 149, max: 162, name: "Tempo" },
    zone4: { min: 163, max: 176, name: "Threshold" },
    zone5: { min: 177, max: 190, name: "Anaerobic" },
  },
  pace_zones: {
    zone1: { min: 405, max: 346, name: "Active Recovery" },
    zone2: { min: 345, max: 316, name: "Endurance" },
    zone3: { min: 315, max: 301, name: "Tempo" },
    zone4: { min: 300, max: 286, name: "Threshold" },
    zone5: { min: 285, max: 256, name: "VO2 Max" },
    zone6: { min: 255, max: 225, name: "Anaerobic" },
  },
  max_hr: 190,
  resting_hr: 50,
  threshold_pace: 300,
} as const;

/**
 * Setup and guided-tour progress. Lives inside the existing preferences jsonb
 * rather than in new columns: no migration, and therefore none of the
 * `drizzle-kit push --force` truncation hazard documented on clubs.joinCode.
 */
export type OnboardingState = {
  /** ISO timestamp of the first visit to /welcome. */
  welcomed_at?: string;
  /** Tour ids the user has finished or skipped. */
  tours_done?: string[];
};

export type UserPreferences = {
  units: "metric" | "imperial";
  onboarding?: OnboardingState;
  hr_zones?: Record<string, { min: number; max: number; name?: string }>;
  pace_zones?: Record<string, { min: number; max: number; name?: string }>;
  max_hr?: number;
  resting_hr?: number;
  threshold_hr?: number | null;
  threshold_pace?: number | null;
  threshold_hr_source?: "sustained_efforts" | "max_fraction" | "manual";
  threshold_pace_source?: "sustained_runs" | "riegel" | "percentile" | "manual";
  ftp?: number | null;
  cycling_power_zones?: Record<string, { min: number; max: number; name?: string }>;
  [key: string]: unknown;
};

// Club CI theme. Color values must pass the server-side sanitizer
// (hex only) before being injected as CSS variables.
export type ClubTheme = {
  primary?: string;
  accent?: string;
  background?: string;
  logoUrl?: string;
};

// =====================================================================
// Tables
// =====================================================================

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),

    stravaAccessToken: varchar("strava_access_token", { length: 255 }),
    stravaRefreshToken: varchar("strava_refresh_token", { length: 255 }),
    stravaAthleteId: integer("strava_athlete_id"),
    stravaTokenExpiresAt: timestamp("strava_token_expires_at"),

    // Platform-level operator flag. Unrelated to clubMemberships.role, which is
    // scoped to a single club. See @/server/auth/admin for how it is resolved.
    isAdmin: boolean("is_admin").notNull().default(false),

    profileSummary: text("profile_summary"),

    // Coaching persona (user-authored, rarely changes) and the athlete profile
    // "living document" (maintained by the chat coach via tool call).
    coachInstructions: text("coach_instructions"),
    athleteProfile: text("athlete_profile"),

    preferences: jsonb("preferences").$type<UserPreferences>().notNull().default(DEFAULT_USER_PREFERENCES),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_key").on(t.email),
    stravaAthleteIdx: uniqueIndex("users_strava_athlete_id_key").on(t.stravaAthleteId),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stravaId: varchar("strava_id", { length: 50 }),

    name: varchar("name", { length: 255 }).notNull(),
    activityType: varchar("activity_type", { length: 50 }).notNull(),
    description: varchar("description", { length: 1000 }),

    workoutType: integer("workout_type"),
    isCommute: integer("is_commute"),

    distance: doublePrecision("distance"),
    duration: integer("duration"),
    elevationGain: doublePrecision("elevation_gain"),
    calories: integer("calories"),

    avgHeartRate: doublePrecision("avg_heart_rate"),
    maxHeartRate: doublePrecision("max_heart_rate"),

    avgPace: doublePrecision("avg_pace"),

    startDate: timestamp("start_date").notNull(),
    startDateLocal: timestamp("start_date_local"),

    rawData: jsonb("raw_data"),
    lapsData: jsonb("laps_data"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    stravaIdIdx: uniqueIndex("activities_strava_id_key").on(t.stravaId),
    startDateIdx: index("activities_start_date_idx").on(t.startDate),
    userIdIdx: index("activities_user_id_idx").on(t.userId),
  }),
);

export const competitions = pgTable(
  "competitions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    raceType: raceTypeEnum("race_type").notNull(),
    distance: doublePrecision("distance"),
    elevationGain: doublePrecision("elevation_gain"),

    raceDate: date("race_date").notNull(),
    location: varchar("location", { length: 255 }),

    goalTime: integer("goal_time"),
    goalPace: doublePrecision("goal_pace"),
    priority: racePriorityEnum("priority").notNull().default("B"),

    notes: varchar("notes", { length: 2000 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    raceDateIdx: index("competitions_race_date_idx").on(t.raceDate),
    userIdIdx: index("competitions_user_id_idx").on(t.userId),
  }),
);

export const uploadedPlans = pgTable(
  "uploaded_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    filename: varchar("filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }),

    contentText: text("content_text"),
    parsedSessions: jsonb("parsed_sessions"),

    // 1 = active, 0 = inactive (kept as integer for parity with FastAPI/SQLite)
    isActive: integer("is_active").notNull().default(1),

    uploadDate: timestamp("upload_date").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("uploaded_plans_user_id_idx").on(t.userId),
  }),
);

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),

    source: sessionSourceEnum("source").notNull().default("app_recommendation"),
    status: sessionStatusEnum("status").notNull().default("planned"),

    plannedWorkout: jsonb("planned_workout"),
    recommendationWorkout: jsonb("recommendation_workout"),

    acceptedSource: varchar("accepted_source", { length: 20 }).notNull().default("none"),
    finalWorkout: jsonb("final_workout"),

    completedActivityId: integer("completed_activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),
    uploadedPlanId: integer("uploaded_plan_id").references(() => uploadedPlans.id, {
      onDelete: "set null",
    }),

    notes: varchar("notes", { length: 2000 }),
    rpeActual: integer("rpe_actual"),

    // Club overlay: how many days (±) this session may shift to align with
    // teammates. 0 = pinned to sessionDate.
    flexDays: integer("flex_days").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    sessionDateIdx: index("training_sessions_session_date_idx").on(t.sessionDate),
    userIdIdx: index("training_sessions_user_id_idx").on(t.userId),
  }),
);

export const zoneHistory = pgTable(
  "zone_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
    source: varchar("source", { length: 50 }).notNull(),

    activitiesAnalyzed: integer("activities_analyzed"),
    dateRangeStart: timestamp("date_range_start"),
    dateRangeEnd: timestamp("date_range_end"),

    maxHr: integer("max_hr"),
    restingHr: integer("resting_hr"),
    hrZones: jsonb("hr_zones"),

    thresholdPace: real("threshold_pace"),
    paceZones: jsonb("pace_zones"),

    ftp: integer("ftp"),
    cyclingPowerZones: jsonb("cycling_power_zones"),

    avgHrEasyRuns: real("avg_hr_easy_runs"),
    avgHrTempoRuns: real("avg_hr_tempo_runs"),
    avgPaceEasyRuns: real("avg_pace_easy_runs"),
    avgPaceTempoRuns: real("avg_pace_tempo_runs"),

    notes: varchar("notes", { length: 500 }),
  },
  (t) => ({
    userIdIdx: index("zone_history_user_id_idx").on(t.userId),
  }),
);

export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),

    // Shared secret a coach hands out so teammates can join themselves.
    //
    // The SQL default is what makes this column safe to add to a populated
    // table: without one, `drizzle-kit push --force` cannot satisfy NOT NULL
    // and silently TRUNCATEs clubs (cascading to memberships and sponsors).
    // Application inserts always pass generateJoinCode(); the SQL side is a
    // backfill only, which is why it is allowed the plainer hex alphabet.
    joinCode: varchar("join_code", { length: 12 })
      .notNull()
      .$defaultFn(generateJoinCode)
      .default(sql`upper(substr(md5(random()::text), 1, 8))`),

    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    themeJson: jsonb("theme_json").$type<ClubTheme>(),
    planTier: clubPlanTierEnum("plan_tier").notNull().default("free"),

    // External donation link (Ko-fi/Stripe/PayPal) — no payment code in-app.
    donationUrl: varchar("donation_url", { length: 500 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("clubs_slug_key").on(t.slug),
    joinCodeIdx: uniqueIndex("clubs_join_code_key").on(t.joinCode),
  }),
);

export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: clubRoleEnum("role").notNull().default("athlete"),
    // typ_only: teammates see availability + session type only (no paces/targets).
    visibility: clubVisibilityEnum("visibility").notNull().default("typ_only"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    clubUserIdx: uniqueIndex("club_memberships_club_user_key").on(t.clubId, t.userId),
    userIdIdx: index("club_memberships_user_id_idx").on(t.userId),
  }),
);

/**
 * Club chat. One row per message, scoped to a club.
 *
 * A new table rather than new columns, so none of the `db:push --force`
 * truncation hazard applies — there is nothing here to truncate.
 *
 * `userId` cascades: deleting an account takes its messages with it, matching
 * clubMemberships and meaning "delete my account" does not leave the athlete's
 * words behind in a club they have left.
 */
export const clubMessages = pgTable(
  "club_messages",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Same ceiling as the other free-text fields in this schema.
    body: varchar("body", { length: 2000 }).notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // The listing query is always "this club, newest last", so the index leads
    // with clubId and carries the sort column.
    clubCreatedIdx: index("club_messages_club_created_idx").on(t.clubId, t.createdAt),
  }),
);

export const sponsors = pgTable(
  "sponsors",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    logoUrl: varchar("logo_url", { length: 500 }),
    url: varchar("url", { length: 500 }),
    discountCode: varchar("discount_code", { length: 100 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    clubIdIdx: index("sponsors_club_id_idx").on(t.clubId),
  }),
);

/**
 * Platform-wide configuration, one row per key.
 *
 * Deliberately key/value rather than a column per flag: the alternative is a
 * schema change for every future switch, and `db:push` on a populated table is
 * the riskiest operation in this repo. The shape of `value` is owned by
 * @/server/services/app-settings, which is the only reader and writer.
 */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Kept for the audit trail; nulled rather than cascaded so deleting an admin
  // account does not erase the settings they last touched.
  updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    category: feedbackCategoryEnum("category").notNull().default("other"),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),

    status: feedbackStatusEnum("status").notNull().default("open"),
    // The operator's reply. Shown to the submitter verbatim, so it is written
    // for them, not as an internal triage note.
    adminNote: text("admin_note"),

    // Where the user was when they hit "Send feedback" — the single most useful
    // piece of context for a bug report, and free to capture.
    pageUrl: varchar("page_url", { length: 200 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("feedback_user_id_idx").on(t.userId),
    statusIdx: index("feedback_status_idx").on(t.status),
  }),
);

// =====================================================================
// Relations
// =====================================================================

export const usersRelations = relations(users, ({ many }) => ({
  activities: many(activities),
  competitions: many(competitions),
  trainingSessions: many(trainingSessions),
  uploadedPlans: many(uploadedPlans),
  zoneHistory: many(zoneHistory),
  clubMemberships: many(clubMemberships),
  feedback: many(feedback),
}));

export const clubsRelations = relations(clubs, ({ many }) => ({
  memberships: many(clubMemberships),
  sponsors: many(sponsors),
}));

export const clubMembershipsRelations = relations(clubMemberships, ({ one }) => ({
  club: one(clubs, { fields: [clubMemberships.clubId], references: [clubs.id] }),
  user: one(users, { fields: [clubMemberships.userId], references: [users.id] }),
}));

export const sponsorsRelations = relations(sponsors, ({ one }) => ({
  club: one(clubs, { fields: [sponsors.clubId], references: [clubs.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const competitionsRelations = relations(competitions, ({ one }) => ({
  user: one(users, { fields: [competitions.userId], references: [users.id] }),
}));

export const uploadedPlansRelations = relations(uploadedPlans, ({ one, many }) => ({
  user: one(users, { fields: [uploadedPlans.userId], references: [users.id] }),
  sessions: many(trainingSessions),
}));

export const trainingSessionsRelations = relations(trainingSessions, ({ one }) => ({
  user: one(users, { fields: [trainingSessions.userId], references: [users.id] }),
  completedActivity: one(activities, {
    fields: [trainingSessions.completedActivityId],
    references: [activities.id],
  }),
  uploadedPlan: one(uploadedPlans, {
    fields: [trainingSessions.uploadedPlanId],
    references: [uploadedPlans.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.id] }),
}));

export const zoneHistoryRelations = relations(zoneHistory, ({ one }) => ({
  user: one(users, { fields: [zoneHistory.userId], references: [users.id] }),
}));

// =====================================================================
// Inferred row types for use in services and route handlers.
// =====================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type NewTrainingSession = typeof trainingSessions.$inferInsert;
export type UploadedPlan = typeof uploadedPlans.$inferSelect;
export type NewUploadedPlan = typeof uploadedPlans.$inferInsert;
export type ZoneHistory = typeof zoneHistory.$inferSelect;
export type NewZoneHistory = typeof zoneHistory.$inferInsert;
export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
export type ClubMembership = typeof clubMemberships.$inferSelect;
export type NewClubMembership = typeof clubMemberships.$inferInsert;
export type ClubMessage = typeof clubMessages.$inferSelect;
export type NewClubMessage = typeof clubMessages.$inferInsert;
export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type ClubRole = ClubMembership["role"];
export type ClubVisibility = ClubMembership["visibility"];
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type FeedbackCategory = Feedback["category"];
export type FeedbackStatus = Feedback["status"];
