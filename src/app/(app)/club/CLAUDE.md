# Club Overlay Feature (`src/app/(app)/club/`)

The club "overlay" sits on top of individual training plans: a week grid with
one row per athlete plus a **"Gemeinsam"** (shared) row of compromise cards
computed by the matching engine (`src/server/engine/`).

## Solo-user contract (do not break)

Club membership is **optional and additive**. A user with zero
`club_memberships` rows sees the app exactly as before — Training, Activities,
Coach chat, Strava all unchanged. `/club` shows a quiet empty state; the
settings "Verein" card renders nothing. Never make a club concept a
precondition for a non-club feature.

## Routes & data flow

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/club` | `requireSession` | caller's memberships |
| `GET /api/club/[slug]` | `requireClubMember` | profile, members, theme+sponsor (paid only) |
| `GET /api/club/[slug]/overlay?week=` | `requireClubMember` | per-member sessions + computed compromises |
| `PATCH /api/club/[slug]/membership` | `requireClubMember` / coach for roles | own visibility; coach edits others' roles |

Auth helpers live in `@/server/auth/club.ts` (`requireClubMember`,
`requireClubRole`) and mirror the `requireSession` union shape
(`{...} | { response }`). The JWT is untouched — membership is resolved
per-request via an indexed join. **Tenancy boundary:** overlay/detail routes
select member data via the `club_memberships` join in the `WHERE`; client input
never chooses whose data loads.

## RBAC

| Role | Sees | Writes |
|---|---|---|
| `coach` | everyone's full data | team (member roles) |
| `athlete` | own full + teammates per their visibility | own plan + own visibility |
| `captain` | same as athlete (logistics role; v2 tools) | own |

A coach cannot change their own role (lockout guard in the membership route).

## Visibility — the single choke point

All redaction lives in `@/server/services/club-serializers.ts`. **The UI never
filters secrets — the server strips them.** Rules:

- viewer is coach, or the member themself, or member.visibility = `full` → full data
- otherwise → availability + `session_type` + `duration_min` only (`redacted: true`)
- **Indirect leaks:** a compromise's `shared_pace_sec` / pace-bearing note can
  reveal a typ_only member's pace. They are included only when **every**
  participant is `full` (or viewer = coach); otherwise the `visibilitySafe`
  note variant is used and `shared_pace_sec` is null.

Tests: `src/server/services/__tests__/club-serializers.test.ts`. Any new
overlay field must go through the serializer and get a redaction test.

## Theme & tier gate (monetization)

`plan_tier` gates paid features via `@/server/services/club-features.ts`
(`clubFeatures`). Free tier → `theme`/`sponsor` nulled server-side in the route
**and** a "Powered by Turbine Turmweg" footer (`powered_by: true`). The gate is
enforced server-side, not just in the UI.

Theme injection: `components/club/theme-scope.tsx` wraps the club page in a
container whose inline style overrides `--primary`/`--accent`/`--background`.
Because `globals.css` maps Tailwind's `--color-*` tokens to those runtime vars,
the override re-themes everything inside via the cascade — scoped to club pages,
no global mutation. **Theme values are sanitized server-side** (`sanitizeClubTheme`,
hex + https-URL allowlist) because `theme_json` is stored data landing in a
style attribute (CSS injection vector).

Sponsor slot + donation button ("Spendier mir ne Club-Mate 🧉", links to
`club.donationUrl` — a configurable URL, no payment integration) live in the
page + `sponsor-footer.tsx`.

## Client wiring

`src/api/club.ts` (axios) + `src/hooks/use-club.ts` (TanStack Query, keys
`['club']`, `['club', slug]`, `['club', slug, 'overlay', weekStart]`). The
grid (`components/club/club-overlay-grid.tsx`) reuses `typeLabel` and the cell
skeleton from `components/training/training-grid.tsx`.

New `/club` route is threaded through the same three touchpoints as any nav
addition: `sidebar.tsx` navItems, `app-layout.tsx` pageTitles, `middleware.ts`
`APP_PATHS`.
