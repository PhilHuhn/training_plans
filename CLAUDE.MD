# Turbine Turmweg Training

## Project Overview
A private training plan management app for runners (5K to ultramarathons) with Strava integration and AI-powered training recommendations.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5.7
- **Styling**: Tailwind CSS v4 (`src/app/globals.css` holds the LaTeX-document tokens — Computer Modern serif on cream paper, hyperref blue links, monochrome chart ramp)
- **State**: `@tanstack/react-query` for server state, `zustand` (with `persist`) for auth + chat
- **UI primitives**: Radix UI + shadcn-style wrappers under `src/components/ui/`
- **DB**: PostgreSQL via Drizzle ORM (`drizzle-orm` + `drizzle-kit`); driver is `postgres`
- **Auth**: bare `jsonwebtoken` (HS256, 7-day expiry) + `bcryptjs`. Bearer header **and** `access_token` HttpOnly cookie are both supported.
- **AI**: official `@anthropic-ai/sdk` — model `claude-sonnet-5`. Tool-use loop for the chat coach; structured JSON output (with short-key compression) for recommendations and document parsing.
- **Document parsing**: `pdf-parse` + `mammoth`
- **FIT export**: `@garmin/fitsdk` (low-level Encoder)

## Project Structure

```
turbine-turmweg/
├── src/
│   ├── app/                                   # App Router
│   │   ├── (auth)/                            # Unauthenticated layout group
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                             # Authenticated shell (sidebar + header + chat panel)
│   │   │   ├── layout.tsx                     # `dynamic = "force-dynamic"` to skip prerender
│   │   │   ├── training/page.tsx              # Three-column training view
│   │   │   ├── activities/page.tsx            # Activity list + recharts
│   │   │   ├── competitions/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── changelog/page.tsx
│   │   ├── api/                               # Route handlers (33 endpoints)
│   │   │   ├── auth/{login,register,me,refresh,logout}/route.ts
│   │   │   ├── strava/{auth-url,callback,disconnect,sync}/route.ts
│   │   │   ├── activities/{route,[id],stats/{summary,by-sport,weekly-by-sport}}/route.ts
│   │   │   ├── competitions/{route,[id]}/route.ts
│   │   │   ├── training/...                   # 11 endpoints incl. generate-recommendations, convert-session, upload-plan, sessions/[id]/export/garmin
│   │   │   ├── settings/...                   # 11 endpoints (account, password, zones + estimate-{,hr,pace,power}, history, revert)
│   │   │   ├── chat/message/route.ts          # Streaming SSE + tool-use loop
│   │   │   ├── changelog/route.ts             # `git log` via child_process
│   │   │   └── health/route.ts
│   │   ├── globals.css                        # LaTeX-document design tokens
│   │   ├── layout.tsx                         # Root layout (mounts Providers, loads CM fonts)
│   │   ├── providers.tsx                      # 'use client' QueryClient + Tooltip + Toaster
│   │   └── page.tsx                           # Cookie-based redirect to /training or /login
│   ├── components/
│   │   ├── ui/                                # 19 Radix-based primitives (Button, Card, Dialog, …)
│   │   ├── layout/                            # AppLayout, Sidebar, Header, ChatPanel
│   │   └── training/                          # SessionCard, TrainingWeek, WeekSummary, SessionModal, GenerateModal
│   ├── hooks/                                 # use-auth, use-training, use-chat, use-activities, use-competitions, use-settings
│   ├── lib/
│   │   ├── types.ts                           # Wire-format types (mirror server response shapes)
│   │   └── utils.ts                           # cn(), date/distance/pace formatters, monochrome color helpers
│   ├── stores/                                # Zustand: auth-store, chat-store (both `'use client'` with SSR-safe localStorage guards)
│   ├── api/                                   # Axios wrappers consumed by hooks
│   ├── middleware.ts                          # Auth-cookie gate; redirects (app)/* → /login when missing
│   ├── types/                                 # Manual `.d.ts` for pdf-parse/lib + @garmin/fitsdk
│   └── server/                                # Server-only code (Next bundler keeps off-client)
│       ├── db/
│       │   ├── schema.ts                      # Drizzle tables + relations + inferred types + DEFAULT_USER_PREFERENCES
│       │   └── index.ts                       # postgres-js client singleton
│       ├── auth/
│       │   ├── jwt.ts                         # signToken / verifyToken
│       │   ├── password.ts                    # bcryptjs cost 10
│       │   └── session.ts                     # getSession / requireSession + cookie helpers
│       ├── http.ts                            # errorJson() + parseJson() for routes
│       ├── serializers.ts                     # Drizzle row → wire-format response shapes
│       ├── env.ts                             # zod-validated env (with .env.local fallback for empty-shell-var safety)
│       ├── prompts/
│       │   └── training-recommendation.ts     # All four Claude prompts verbatim
│       └── services/
│           ├── claude.ts                      # Anthropic client + short-key system + JSON extractor
│           ├── training-engine.ts             # generateRecommendations / convertSession / saveRecommendations
│           ├── training-load.ts               # Bannister TRIMP + planned-load estimator
│           ├── strava.ts                      # OAuth refresh + sync + lap analysis + AI profile-summary
│           ├── document-parser.ts             # PDF/DOCX → text → Claude → structured sessions
│           ├── fit-export.ts                  # Garmin FIT encoder (workout file)
│           ├── zones.ts                       # HR/pace/cycling-power zone math + Strava-driven estimation
│           └── pace.ts                        # formatPace / parsePace / formatGoalTime
├── drizzle/                                   # drizzle-kit migration output (initial: 0000_famous_blindfold.sql)
├── drizzle.config.ts
├── next.config.ts                             # serverExternalPackages: pdf-parse, mammoth, @garmin/fitsdk
├── postcss.config.mjs                         # Tailwind v4 plugin
├── tsconfig.json                              # Strict + path alias `@/*` → ./src/*
├── docker-compose.yml                         # Postgres-only
├── render.yaml                                # Render web + db deploy spec
└── .env                                       # Local-only secrets (gitignored)
```

## Club overlay feature

A club "overlay" layer sits on top of individual plans and finds shared/parallel
sessions between club members without compromising anyone's training stimulus.
It is **optional and additive** — solo users are unaffected. Three feature docs:

- **`src/server/engine/CLAUDE.md`** — the matching engine (taxonomy → compat
  classes, merge matrix, the guardrail invariant, pace-band math, purity rules).
  Pure TS, TDD, no DB/SDK imports.
- **`src/app/(app)/club/CLAUDE.md`** — routes, RBAC, the single visibility
  serializer choke point, theme + `plan_tier` gate, solo-user contract.
- **`scripts/CLAUDE.md`** — the `sub-77` seed (`npm run db:seed:club`) and its
  shared fixture with the engine tests.

Tests run with **Vitest**: `npm run test` (engine guardrails, serializers, ics).

## Database Schema (Drizzle)

Single canonical source: `src/server/db/schema.ts`. Nine tables, all keyed by `serial id`:

- **appSettings** — key (PK, varchar 64), value (jsonb), updatedAt, updatedByUserId FK (set null). Platform-wide config, one row per key; today only `"ai"`. Owned by `@/server/services/app-settings`.
- **feedback** — userId FK cascade, category (pgEnum bug/feature/question/other), title, body, status (pgEnum open/planned/in_progress/done/declined, default open), adminNote (shown to the submitter), pageUrl, createdAt/updatedAt; indexes on userId and status
- **users** — email (unique), passwordHash, name, **isAdmin** (boolean, default false — platform operator, not a club role), Strava tokens + athleteId (unique), profileSummary (text, AI-generated post-sync), preferences (jsonb with default seed for HR/pace zones, max_hr, resting_hr)
- **activities** — userId FK, stravaId (unique), name, activityType, distance, duration, elevationGain, calories, avgHeartRate, maxHeartRate, avgPace (sec/km), startDate (indexed), rawData + lapsData (jsonb)
- **competitions** — userId FK, name, raceType (pgEnum 5K/10K/HM/M/50K/100K/50M/100M/OTHER), raceDate (indexed), distance, location, goalTime, goalPace, priority (pgEnum A/B/C, default B), notes
- **trainingSessions** — userId FK, sessionDate (indexed), source (pgEnum app_recommendation/uploaded_plan/manual/ics_import), status (pgEnum planned/completed/skipped/modified), plannedWorkout + recommendationWorkout + finalWorkout (jsonb), acceptedSource (varchar), completedActivityId FK, uploadedPlanId FK, rpeActual, **flexDays** (int, ± days a session may shift for club matching; default 0)
- **uploadedPlans** — userId FK, filename, contentType, contentText (text), parsedSessions (jsonb), isActive (integer 1/0)
- **zoneHistory** — userId FK, calculatedAt, source ("manual" | "strava_estimate" | "reverted"), maxHr, restingHr, hrZones (jsonb), thresholdPace, paceZones (jsonb), ftp, cyclingPowerZones (jsonb), plus avg HR/pace metrics
- **clubs** — name, slug (unique), **joinCode** (varchar 12, unique — the code teammates use to join), createdByUserId FK, themeJson (jsonb CI: primary/accent/background/logoUrl hex), planTier (pgEnum free/paid, default free), donationUrl (varchar)
- **clubMemberships** — clubId FK, userId FK, role (pgEnum coach/athlete/captain, default athlete), visibility (pgEnum typ_only/full, default typ_only); unique (clubId, userId)
- **sponsors** — clubId FK, name, logoUrl, url, discountCode

Migrations live in `drizzle/`. JSON column shape changes do **not** need a new migration — only top-level columns do. **Migration policy:** the local DB is managed with `npm run db:push` (drizzle-kit push), not the journal-based `generate`+`migrate` flow — `0001_wandering_pixie.sql` was generated for review but the DB is push-managed. Stay on `db:push`; don't mix the two (it causes drift).

**A new `notNull` column MUST carry a SQL-level `.default(...)`.** On Render, `db:push` runs with `--force` (no TTY to answer prompts); a `notNull` column with only a `$defaultFn` — which is applied client-side, on insert — leaves push unable to satisfy the constraint, and it resolves that by **TRUNCATE**-ing the table and everything referencing it. `clubs.joinCode` carries `.default(sql\`upper(substr(md5(random()::text), 1, 8))\`)` for exactly this reason. Verify any such change by dropping the column on a populated local DB and re-pushing before you ship it.

## AI integration patterns

- **Short-key system** (`src/server/services/claude.ts`): `_TOP_KEYS` (a/wf/ss/w), `_SESSION_KEYS` (16 mappings), `_INTERVAL_KEYS` (r/dm/tp/rec). `expandShortKeys` is idempotent and recursive (handles `intervals` arrays + nested `alternative_workout`).
- **JSON extractor** has three fallbacks: brace-matching (handles surrounding text), repair pass (trailing commas + unquoted keys), truncation recovery (closes unclosed brackets/braces).
- **Tool-use chat** (`src/app/api/chat/message/route.ts`): seven tools (`get_training_sessions`, `get_session_details`, `update_session_workout`, `create_session`, `get_recent_activities`, `get_upcoming_competitions`, `get_user_zones`); loop continues while `stop_reason === "tool_use"`. Streaming branch wraps the final text in SSE (`data: {...,"done":true}`).

## Routes

### HTML pages
- `/login`, `/register` — public, redirect to `/training` if cookie present
- `/welcome` — post-registration setup (Strava, club, tour). Token-gated but deliberately **not** in `navItems`: that array numbers both the sidebar TOC and the header's "Section N" eyebrow, so inserting into it renumbers everything below
- `/training`, `/activities`, `/competitions`, `/settings`, `/changelog` — gated by middleware

### API endpoints (all prefixed with `/api`)

Same surface as the original FastAPI backend (37 endpoints) — see `src/app/api/...` for the full tree. Highlights:

- `POST /auth/{register,login,me,refresh,logout}` — `me` uses Bearer or cookie
- `GET /strava/auth-url`, `GET /strava/callback`, `POST /strava/{disconnect,sync}` — sync runs token refresh, paginates activities, fetches lap data, regenerates the Claude profile summary
- Activities + competitions + training sessions: standard CRUD plus `accept`, `week` (with TRIMP enrichment), `generate-recommendations` and `upload-plan` (both with an SSE `?stream=true` variant), `convert-session`, `uploaded-plans`, `sessions/[id]/export/garmin`, `export/ics`, `import/ics`
- `GET /club`, `GET /club/[slug]`, `GET /club/[slug]/overlay?week=`, `PATCH /club/[slug]/membership` — club overlay (see `src/app/(app)/club/CLAUDE.md`)
- `POST /chat/message` — streaming SSE by default; pass `{stream: false}` for JSON
- Settings: `account`, `password`, `onboarding` (setup + tour progress), zones (`PUT`, `history`, `revert/[historyId]`, `estimate*`)

## Environment variables

Defined and validated in `src/server/env.ts` (zod). The loader falls back to `.env.local` then `.env` when a process.env value is missing or empty — this is intentional, because some shells inject empty `ANTHROPIC_API_KEY=` envs that would otherwise mask the real value.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SECRET_KEY` | JWT signing (HS256, ≥16 chars) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth |
| `AI_API_KEY` | Key for the AI upstream. An `sk-or-…` key selects OpenRouter on its own |
| `AI_BASE_URL` | Override the upstream host. Optional — inferred from an OpenRouter key |
| `ANTHROPIC_API_KEY` | Legacy fallback for `AI_API_KEY`. **All of them empty disables every AI feature**, whatever the admin toggle says |
| `BASE_URL` | Public origin used for the Strava redirect URI |
| `ADMIN_EMAILS` | Comma-separated platform-operator emails; grants `/admin` without a DB flag |

## Development workflow

- `docker compose up -d db` to boot Postgres
- `npm run db:push` after editing `schema.ts` (push-managed — see migration policy above)
- `npm run db:seed:club` to seed the sub-77 demo tenant
- `npm run dev` for HMR
- `npm run test` for the Vitest suites (engine guardrails, serializers, ics)
- `npm run build` to verify production build (also runs `tsc -b`)

## Conventions

- Server-only modules: import `"server-only"` at the top to enforce.
- Route handlers: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` to opt out of static prerender.
- Auth: every gated route uses `requireSession(req)` which returns `{user}` or `{response}` (a 401 NextResponse) — pattern is `if ("response" in session) return session.response`. Club-scoped routes use `requireClubMember` / `requireClubRole` (`@/server/auth/club`); `/api/admin/**` uses `requireAdmin` (`@/server/auth/admin`), which is the real gate — `middleware.ts` only checks that a cookie is present.
- **AI features are gated, not assumed.** Five routes spend upstream credit: `chat/message`, `training/generate-recommendations`, `training/convert-session`, `training/upload-plan`, and `strava/sync` (the profile summary). Each of the first four starts with `requireAiEnabled()` (`@/server/services/ai-gate`), which answers **503 + the operator's notice** — the same contract `classifyClaudeError` uses, so `use-chat.ts` renders it unchanged. `strava/sync` degrades instead: it skips the summary and keeps the deterministic `fallbackProfileLine`. Never answer 401 from an AI failure — the axios interceptor would sign every athlete out. Any new Claude call site needs the same gate.
- **Never forward an upstream provider message to the browser.** `claude.ts` stamps `Claude error: ` onto failures it catches; `isUpstreamClaudeError` / `classifyEngineError` (`@/server/services/claude-errors`) turn those into a safe `detail` while leaving the app's own messages ("Unsupported file type") intact. The raw text goes to the server log.
- **One version, in `package.json`.** `next.config.ts` reads it at build time into `NEXT_PUBLIC_APP_VERSION`, alongside `NEXT_PUBLIC_GIT_COMMIT` from Render's `RENDER_GIT_COMMIT`; `@/lib/version` formats both into `v1.0.0 · 8b7be0a` for the sidebar colophon and `/api/health`. Bump `package.json` and nothing else. The commit half is the load-bearing part — it answers "is the build I just deployed actually live", which is the question that costs real time. Both degrade to "" rather than to a placeholder, and the colophon omits itself entirely when empty.
- **Never trust `response.content` to be an array.** Anthropic guarantees the documented block shape; **OpenRouter does not** — its Anthropic-compatible endpoint translates from whatever the routed model speaks, and a third-party model has been seen returning `content` as a bare string or `null`. Read it through `@/lib/message-content` (`normalizeContentBlocks` / `textFromBlocks` / `toolUsesFromBlocks`), never with a direct `for…of` or `.filter` and never via an `as ContentBlock[]` cast, which is a lie the compiler accepts. The tool loop additionally breaks when `stop_reason === "tool_use"` yields no usable block: replying with an empty tool_result array asks the same question forever, spending on every pass.
- **One AI upstream, resolved from config.** `@/lib/ai-provider` maps `AI_BASE_URL` + `AI_API_KEY` onto a provider, a `baseURL` and a default model; `anthropic()` in `claude.ts` is the only place that constructs a client. OpenRouter is reached through its Anthropic-compatible Messages endpoint, so streaming, the tool loop and thinking blocks are untouched by the switch — a provider that needed a different protocol would be a rewrite, not a config change. The model is *not* a constant: `aiModel()` reads the operator's choice from `app_settings` and falls back to the provider default, because a bare Anthropic id and an OpenRouter slug are not interchangeable. Resolve it once per *operation*, never per hop — `chat/message` hoists it out of the tool loop for exactly this reason. **`AI_BASE_URL` must not include `/v1`:** the SDK appends a hardcoded `/v1/messages` by string concatenation, so a base ending in `/v1` produces `/api/v1/v1/messages`, and the resulting 404 classifies as "model unavailable" — pointing the operator at the model field for a fault that isn't there.
- **A long AI operation reports real stages, never a spinner.** Two routes stream progress over SSE — `training/generate-recommendations` and `training/upload-plan` (`?stream=true`) — because both wrap a model call that runs for minutes. The machinery is already shared and cheap to extend: `callJson` in `claude.ts` streams *every* Claude call and emits `thinking` / `writing` + a live session count, so wiring a new caller up is a matter of forwarding an `onProgress` callback rather than building anything. Client side, `@/lib/sse` does the framing (a `data:` line can straddle a chunk boundary — do not re-hand-roll the split), `@/lib/import-progress` holds the stage vocabulary, and `StageProgress` renders the checklist for both flows. Gates and auth run **before** the stream opens, so a rejection is still a real status code and an in-stream failure is an `error` frame in a 200 — never a 401.
- **Plan import lives on `/training`, not in Settings.** The `Import Plan` button beside `AI Plan` opens `ImportPlanModal`, which goes through `useUploadPlan()` — the hook matters as much as the upload, since it invalidates `trainingWeek` / `trainingRange` / `uploadedPlans` and is what makes the grid repopulate without a reload. Keep the client `accept` list in step with `ALLOWED_EXT` in the route. The `.ics` import/export controls are deliberately **not** rendered: `ics-toolbar.tsx`, `export/ics` and `import/ics` all still work, and re-enabling them is one import in `training/page.tsx`. The export is a `Content-Disposition: attachment` download behind a session token, not a subscribable feed, so nothing was polling it.
- **Guided tours are data, not components.** Steps live in `@/lib/tour-steps` (pure — no React, no DOM), point at elements by `data-tour="…"`, and are driven by `TourProvider` (mounted in `app/providers.tsx`, above the app shell, so `/welcome` can start one). A step whose anchor never resolves is **skipped after a timeout, not waited on** — and "resolves" means *visible*, not merely present: the desktop sidebar is `hidden lg:block`, so on a phone its anchors are still in the DOM with zero area, and `findAnchor` rejects them on that basis. Preconditions are tags (`when: 'strava-disconnected'`) resolved by the provider, which keeps the step list free of app types — and a filtered-out step leaves the count honest ("Step 3 of 5", not "of 6"). Adding a step means adding an object and a `data-tour` attribute; nothing else.
- **Onboarding state lives in `users.preferences`,** not new columns — `preferences` is an existing notNull jsonb with a default, so there is no DDL and none of the truncation hazard above. `PATCH /api/settings/onboarding` merges with SQL (`preferences || '{...}'::jsonb`), **not** a read-modify-write: several of these race routinely, and a whole-column rewrite lets the loser's changes vanish — including `welcomed_at`, whose absence permanently stops the tour auto-starting for that account.
- **A Strava return path is a whitelist key, never a path.** `state` round-trips through Strava and comes back from outside our control, so `@/server/services/strava-return` resolves it against a fixed map. Passing a raw path would make the callback an open redirect.
- Sport colours and icons: one map, `@/lib/sport-theme`. Charts, badges, filter tabs and session cards all read `sportTheme(stravaType)` / `planningSportTheme(sport)`; the `--chart-*` tokens in `globals.css` mirror `SPORT_COLORS`. Don't re-derive a per-sport colour or icon anywhere else.
- Wire format: TypeScript types in `src/lib/types.ts` are the canonical client contract. Server response builders in `src/server/serializers.ts` produce that exact shape from Drizzle rows.
- Style: LaTeX-document tokens in `globals.css`. Hairline borders, italic small-caps for status, justified body text via `.prose-paper`. Avoid bringing back the old neo-brutalist `border-2 border-[#092B37]` / `shadow-brutal` classes.

## Design Guidelines

- Body in Computer Modern serif (with Latin Modern / Charter / Georgia fallbacks), 17px, line-height 1.55.
- Backgrounds in cream `#FAF8F2`, ink `#0A0A0A`, links and primary in hyperref blue `#1F3A93`, accent/destructive in maroon `#7E1F2E`.
- Auto-numbered sections via CSS counters on `<main class="tex-numbered">`.
- Tables follow the booktabs convention: thicker top + bottom rules, hairline mid rule, no row stripes.
- All Radix primitives + state-using components are `'use client'`.
