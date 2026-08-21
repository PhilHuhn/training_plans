CREATE TYPE "public"."race_priority" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."race_type" AS ENUM('5K', '10K', 'HM', 'M', '50K', '100K', '50M', '100M', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."session_source" AS ENUM('app_recommendation', 'uploaded_plan', 'manual');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('planned', 'completed', 'skipped', 'modified');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"strava_id" varchar(50),
	"name" varchar(255) NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"description" varchar(1000),
	"workout_type" integer,
	"is_commute" integer,
	"distance" double precision,
	"duration" integer,
	"elevation_gain" double precision,
	"calories" integer,
	"avg_heart_rate" double precision,
	"max_heart_rate" double precision,
	"avg_pace" double precision,
	"start_date" timestamp NOT NULL,
	"start_date_local" timestamp,
	"raw_data" jsonb,
	"laps_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"race_type" "race_type" NOT NULL,
	"distance" double precision,
	"elevation_gain" double precision,
	"race_date" date NOT NULL,
	"location" varchar(255),
	"goal_time" integer,
	"goal_pace" double precision,
	"priority" "race_priority" DEFAULT 'B' NOT NULL,
	"notes" varchar(2000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_date" date NOT NULL,
	"source" "session_source" DEFAULT 'app_recommendation' NOT NULL,
	"status" "session_status" DEFAULT 'planned' NOT NULL,
	"planned_workout" jsonb,
	"recommendation_workout" jsonb,
	"accepted_source" varchar(20) DEFAULT 'none' NOT NULL,
	"final_workout" jsonb,
	"completed_activity_id" integer,
	"uploaded_plan_id" integer,
	"notes" varchar(2000),
	"rpe_actual" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(100),
	"content_text" text,
	"parsed_sessions" jsonb,
	"is_active" integer DEFAULT 1 NOT NULL,
	"upload_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"strava_access_token" varchar(255),
	"strava_refresh_token" varchar(255),
	"strava_athlete_id" integer,
	"strava_token_expires_at" timestamp,
	"profile_summary" text,
	"preferences" jsonb DEFAULT '{"units":"metric","hr_zones":{"zone1":{"min":0,"max":130,"name":"Recovery"},"zone2":{"min":130,"max":150,"name":"Aerobic"},"zone3":{"min":150,"max":165,"name":"Tempo"},"zone4":{"min":165,"max":180,"name":"Threshold"},"zone5":{"min":180,"max":220,"name":"VO2max"}},"pace_zones":{"easy":{"min":330,"max":390,"name":"Easy"},"moderate":{"min":300,"max":330,"name":"Moderate"},"tempo":{"min":270,"max":300,"name":"Tempo"},"threshold":{"min":250,"max":270,"name":"Threshold"},"interval":{"min":210,"max":250,"name":"Interval"}},"max_hr":190,"resting_hr":50}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"source" varchar(50) NOT NULL,
	"activities_analyzed" integer,
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"max_hr" integer,
	"resting_hr" integer,
	"hr_zones" jsonb,
	"threshold_pace" real,
	"pace_zones" jsonb,
	"ftp" integer,
	"cycling_power_zones" jsonb,
	"avg_hr_easy_runs" real,
	"avg_hr_tempo_runs" real,
	"avg_pace_easy_runs" real,
	"avg_pace_tempo_runs" real,
	"notes" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_completed_activity_id_activities_id_fk" FOREIGN KEY ("completed_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_uploaded_plan_id_uploaded_plans_id_fk" FOREIGN KEY ("uploaded_plan_id") REFERENCES "public"."uploaded_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_plans" ADD CONSTRAINT "uploaded_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_history" ADD CONSTRAINT "zone_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_strava_id_key" ON "activities" USING btree ("strava_id");--> statement-breakpoint
CREATE INDEX "activities_start_date_idx" ON "activities" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "activities_user_id_idx" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competitions_race_date_idx" ON "competitions" USING btree ("race_date");--> statement-breakpoint
CREATE INDEX "competitions_user_id_idx" ON "competitions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_sessions_session_date_idx" ON "training_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "training_sessions_user_id_idx" ON "training_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uploaded_plans_user_id_idx" ON "uploaded_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_strava_athlete_id_key" ON "users" USING btree ("strava_athlete_id");--> statement-breakpoint
CREATE INDEX "zone_history_user_id_idx" ON "zone_history" USING btree ("user_id");