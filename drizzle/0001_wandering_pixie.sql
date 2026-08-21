CREATE TYPE "public"."club_plan_tier" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TYPE "public"."club_role" AS ENUM('coach', 'athlete', 'captain');--> statement-breakpoint
CREATE TYPE "public"."club_visibility" AS ENUM('typ_only', 'full');--> statement-breakpoint
ALTER TYPE "public"."session_source" ADD VALUE 'ics_import';--> statement-breakpoint
CREATE TABLE "club_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "club_role" DEFAULT 'athlete' NOT NULL,
	"visibility" "club_visibility" DEFAULT 'typ_only' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"theme_json" jsonb,
	"plan_tier" "club_plan_tier" DEFAULT 'free' NOT NULL,
	"donation_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"logo_url" varchar(500),
	"url" varchar(500),
	"discount_code" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "preferences" SET DEFAULT '{"units":"metric","hr_zones":{"zone1":{"min":120,"max":134,"name":"Active Recovery"},"zone2":{"min":135,"max":148,"name":"Endurance"},"zone3":{"min":149,"max":162,"name":"Tempo"},"zone4":{"min":163,"max":176,"name":"Threshold"},"zone5":{"min":177,"max":190,"name":"Anaerobic"}},"pace_zones":{"zone1":{"min":405,"max":346,"name":"Active Recovery"},"zone2":{"min":345,"max":316,"name":"Endurance"},"zone3":{"min":315,"max":301,"name":"Tempo"},"zone4":{"min":300,"max":286,"name":"Threshold"},"zone5":{"min":285,"max":256,"name":"VO2 Max"},"zone6":{"min":255,"max":225,"name":"Anaerobic"}},"max_hr":190,"resting_hr":50,"threshold_pace":300}'::jsonb;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "flex_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "coach_instructions" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "athlete_profile" text;--> statement-breakpoint
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_memberships_club_user_key" ON "club_memberships" USING btree ("club_id","user_id");--> statement-breakpoint
CREATE INDEX "club_memberships_user_id_idx" ON "club_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sponsors_club_id_idx" ON "sponsors" USING btree ("club_id");