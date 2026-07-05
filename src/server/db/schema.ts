import {
  pgTable,
  serial,
  varchar,
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
import { relations } from "drizzle-orm";

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
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "planned",
  "completed",
  "skipped",
  "modified",
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

export type UserPreferences = {
  units: "metric" | "imperial";
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

    profileSummary: text("profile_summary"),

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

// =====================================================================
// Relations
// =====================================================================

export const usersRelations = relations(users, ({ many }) => ({
  activities: many(activities),
  competitions: many(competitions),
  trainingSessions: many(trainingSessions),
  uploadedPlans: many(uploadedPlans),
  zoneHistory: many(zoneHistory),
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
