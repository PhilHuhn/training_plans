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
- A Strava API app and an Anthropic API key

### One-time setup

```bash
git clone <repo-url> turbine-turmweg
cd turbine-turmweg

cp .env.example .env
# Edit .env: set SECRET_KEY (`openssl rand -hex 32`),
# STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET, ANTHROPIC_API_KEY.

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

The repo includes a [`render.yaml`](render.yaml) for one-click deployment to [Render](https://render.com):

- A managed Postgres database
- A web service running `npm ci && npm run db:push && npm run build` then `npm start`
- `SECRET_KEY` auto-generated; `DATABASE_URL` wired from the database
- `STRAVA_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `BASE_URL` set as sync-disabled secrets

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
└── render.yaml                     # Render deploy spec
```

## License

Private — all rights reserved.
