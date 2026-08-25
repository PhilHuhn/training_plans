# Turbine Turmweg Training

AI-powered training plan management for runners — from 5K to ultramarathons.

## Features

- **Strava sync** — auto-import activities (with lap data) for runs, rides, swims, and more
- **Competition tracker** — A/B/C-priority races with goal time and days-until countdown
- **Three-column training view** — uploaded plan / AI recommendation / final accepted workout, side by side
- **AI recommendations** — periodized weekly plans powered by Claude, aware of your zones, recent load (TRIMP), and upcoming races
- **Document upload** — drop a PDF/Word/Markdown plan and Claude extracts every session into structured form
- **Pace ↔ HR conversion** — flip a single session between pace-based and HR-based formats
- **Garmin FIT export** — download structured workouts as `.fit` files for your watch
- **AI coach chat** — streaming chat (`Turbi`) that can read and modify your plan via tool-use
- **Zone estimation** — derive HR / pace / cycling power zones from your Strava history
- **LaTeX-document UI** — Computer Modern serif on cream paper, hyperref blue links, booktabs tables
- **Landing page** — public `/` page explaining what the app does; signed-in visitors are redirected to `/training`
- **Guided setup and tour** — new accounts land on `/welcome` to connect Strava and join a club, then get walked through the app

## Getting started as a new user

Registering lands you on `/welcome` rather than an empty training week. Two
optional steps — **connect Strava** and **join or start a club** — and both can
be skipped; nothing there blocks you from using the app. From there, **Show me
around** runs a short guided tour of the sidebar, the training week, the coach
panel and the feedback button. It runs once, and Settings › Account has
**Replay the tour** and **Re-run setup** if you want either again.

Steps that no longer apply drop out: if Strava is already connected, the tour
never mentions connecting it.

### What's new

The running version sits in the bottom-left of the sidebar as `v1.0.0 · 8b7be0a` — the
release plus the deployed commit, so you can always tell which build you are looking at.
Clicking it opens `/changelog`, which is otherwise deliberately absent from the sidebar.
`GET /api/health` reports the same pair, so a deploy can be confirmed with a curl.

Bump the version in `package.json`; nothing else needs changing.

## Clubs

Anyone can start a club from `/club` and becomes its coach. Coaches see a short
**join code** on the club settings card; teammates paste it into "Join a club"
to become athletes. Joining never widens what teammates can see of your
training — new members start at `typ_only` visibility and change it themselves.

## Admin

Set `ADMIN_EMAILS` to a comma-separated list of operator emails and those
accounts get an **Admin** section listing every registered user and club, with
controls for club roles, member visibility, club tier and the donation link.
Admins can also grant admin to other accounts (stored as `users.is_admin`); the
env var is the bootstrap and stays the way back in if the flag is ever lost.

## Feedback

Anyone can report a bug or request a feature from the **Send feedback** button in the app
header, or under Settings › Feedback. Submissions land in the admin dashboard with a status
(Open · Planned · In progress · Done · Won't do); the note an admin writes against an item is
shown back to the person who sent it, so they can see what came of it.

## The AI upstream

The coach, plan generation, plan parsing and the Strava profile summary all call the same
model. Two providers are supported and the app picks between them from configuration alone:

| Set | Result |
|---|---|
| `AI_API_KEY=sk-or-…` | **OpenRouter.** The base URL is inferred; no other change needed |
| `AI_BASE_URL=https://openrouter.ai/api` | OpenRouter, for a key that does not carry the prefix. Note: no `/v1` — the SDK appends it |
| `ANTHROPIC_API_KEY=sk-ant-…` | Anthropic direct (the legacy setting, still supported) |

OpenRouter is reached through its Anthropic-compatible Messages endpoint, so streaming, the
tool-use loop and thinking blocks behave identically either way. The practical reason to
prefer it is spend control: a prepaid balance with per-key limits, rather than an open-ended
bill.

The **model** is set in `/admin` rather than in the environment, so switching to a cheaper
one takes effect on the next request with no redeploy. Leave it empty to use the provider's
default. Note that the ids are not interchangeable — Anthropic takes `claude-sonnet-5`,
OpenRouter takes `anthropic/claude-sonnet-4.5`.

### Turning AI off

Admins can switch every AI feature off from the **AI features** card in `/admin` — each
credit-spending route then answers with an operator-authored notice instead, and the rest of
the app is unaffected. Clearing the API key has the same effect and overrides the toggle.

## Pricing

Everything is **free to use** today — no paid tier, no usage limits.

### TODO — monetization

- [ ] Donations (one-off) — payment link + a supporter mention
- [ ] Steady accounts — recurring supporter membership

Until those land, the landing page (`src/app/page.tsx`) states plainly that the
app is free. The `TODO(monetization)` comment at the top of that file marks the
copy that has to change when pricing arrives.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript 5.7 + React 19
- **Database**: PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) (with `drizzle-kit` migrations)
- **Auth**: bare `jsonwebtoken` (HS256, 7-day) + `bcryptjs`. Bearer header *and* `access_token` cookie supported.
- **AI**: [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) — `claude-sonnet-5`
- **Document parsing**: `pdf-parse` (PDF) + `mammoth` (DOCX)
- **FIT export**: `@garmin/fitsdk` (official Garmin JS SDK)
- **State**: `@tanstack/react-query` + `zustand`
- **Styling**: Tailwind CSS v4 with the LaTeX-document design tokens defined in `src/app/globals.css`

## Local development

### Prerequisites

- Node.js 20+
- Docker (for Postgres)
- A Strava API app, and an OpenRouter or Anthropic API key

### One-time setup

```bash
git clone <repo-url> turbine-turmweg
cd turbine-turmweg

cp .env.example .env
# Edit .env: set SECRET_KEY (`openssl rand -hex 32`),
# STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET, and AI_API_KEY
# (an OpenRouter sk-or-… key, or ANTHROPIC_API_KEY for Anthropic direct).

npm install
docker compose up -d db        # Postgres on :5432
npm run db:push                # Apply Drizzle schema
```

### Running

```bash
npm run dev
```

Visit `http://localhost:3000`. You'll be redirected to `/login` — register an account and you'll land on `/training`.

### npm scripts

| script | description |
|---|---|
| `dev` | Next dev server with HMR on port 3000 |
| `build` | Production build (`tsc` + `next build`) |
| `start` | Run the production build |
| `lint` | `next lint` |
| `db:generate` | Generate a new SQL migration from `src/server/db/schema.ts` |
| `db:push` | Apply the current schema to the configured DB (idempotent; safe for fresh setup) |
| `db:studio` | Open Drizzle Studio at `https://local.drizzle.studio` to browse the DB |

## Strava OAuth setup

1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Set the **Authorization Callback Domain** to `localhost` for development, or your production hostname for prod
4. Copy the Client ID and Client Secret to your `.env`

The redirect URI is built from `BASE_URL` — make sure that env var matches the URL Strava will redirect to (`http://localhost:3000` locally, your domain in prod).

## Deployment

The app runs on [Render](https://render.com): a managed Postgres database and a Node web
service, auto-deploying from `master`.

[`render.yaml`](render.yaml) documents the intended configuration, but **it is not applied** —
the live service was created in the dashboard, and the dashboard is its source of truth. The
file's header explains why attaching it as a Blueprint would duplicate the service rather than
adopt it. Deploy settings are changed in the dashboard; the file records what they should be.

What the service needs, however it is created:

- Node 22, Postgres, and the env vars listed in [`.env.example`](.env.example)
- Build `npm ci && npm run build`, pre-deploy `npm run db:push`, start `npm start`
- A health check on `/api/health`, so a failed boot never receives traffic
- `DATABASE_URL` wired from the database; `SECRET_KEY` set once and never rotated
  (rotating it invalidates every session)

Other targets (Vercel, Fly.io, Railway) work too — you just need a Node 20+ runtime, Postgres, and the same env vars.

## Repo layout

```
turbine-turmweg/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/login,register/  # Public pages
│   │   ├── (app)/                  # Auth-gated shell (sidebar + header + chat panel)
│   │   │   ├── training/           # Three-column training view
│   │   │   ├── activities/         # Strava activity list + charts
│   │   │   ├── competitions/       # Race tracker
│   │   │   ├── settings/           # Zones, profile, Strava connection
│   │   │   └── changelog/          # Git log viewer
│   │   ├── api/                    # 33 route handlers (auth, training, strava, chat, …)
│   │   ├── globals.css             # LaTeX-document design tokens
│   │   └── providers.tsx           # React Query + Tooltip + Toaster
│   ├── components/                 # UI kit (Radix-based) + layout + training widgets
│   ├── hooks/                      # use-auth, use-training, use-chat, …
│   ├── lib/                        # Wire types, formatters
│   ├── stores/                     # Zustand: auth + chat
│   ├── middleware.ts               # Auth-cookie gate for the (app) group
│   └── server/                     # Server-only code (Next bundler keeps it off the client)
│       ├── db/                     # Drizzle schema + client singleton
│       ├── auth/                   # JWT + bcrypt + session helpers
│       ├── services/               # Claude, training engine, Strava, document parser, FIT export, zones, TRIMP
│       └── prompts/                # Claude prompts
├── drizzle/                        # Generated migrations
├── docker-compose.yml              # Postgres only
└── render.yaml                     # Intended Render config (not applied — see its header)
```

## License

Private — all rights reserved.
