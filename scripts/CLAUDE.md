# Scripts (`scripts/`)

## `seed-club.ts` — sub-77 demo tenant

```
npm run db:seed:club
```

Seeds **Tenant 0 "sub-77"** (Hamburg, `plan_tier: paid`) + sponsor **Hamburger
Laufladen** (discount `SUB77-10`) + 4 athletes with distinct threshold paces
(250 / 275 / 283 / 305 s/km) and goal races (1 marathon, 2×10k, 1 HM) + one
fixture week of planned sessions.

**Demo login:** `<vorname>@sub77.example` / `sub77-demo`
(mara=coach, tade=captain, timo=athlete, hanna=athlete & `typ_only`).

### Idempotency contract

Re-running is safe: users are upserted by email, the club by slug; the club's
memberships, sponsors, the seeded athletes' competitions, and the fixture-week
training sessions are wiped and rewritten each run. It does **not** touch other
users or other weeks.

### Shared fixture (no drift)

The week's plans come from `src/server/engine/__tests__/fixtures/sub77-week.ts`
— the **same** module the engine tests assert against. Seed data and the
engine's pinned expectations therefore cannot diverge. Edit the fixture and
both the seed and the tests follow. The script prints the engine's compromise
output at the end as a live sanity check (matches the fixture test).

### DB migration note

The local DB is managed with **`drizzle-kit push`**, not journal-based
migrations (see root `CLAUDE.md`). The seed assumes the club tables already
exist — run `npm run db:push` first after schema changes.
