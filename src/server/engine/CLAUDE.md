# Club Matching Engine (`src/server/engine/`)

The core IP of the club overlay: given a club's members and their week of
sessions, it finds **shared and parallel training opportunities without
compromising anyone's training stimulus**.

## The guardrail invariant (never break this)

> No merge may change any member's zone/stimulus. The engine never pulls A's
> recovery run into B's threshold pace. When the stimulus diverges, the answer
> is "same location, parallel session" — never a forced shared effort.

This is enforced at runtime by `guardrails.ts` (`assertStimulusPreserved`),
which every candidate compromise passes through in `match-week.ts` before it is
emitted, **and** directly by `__tests__/guardrails.test.ts`. If you change the
matcher, the guardrail tests must still fail when the invariant is violated
(sanity check: temporarily widen `THRESHOLD_SHARE_BAND_SEC` in `matrix.ts` and
`npm run test` must go red).

## Purity constraint

This directory must **not** import from `@/server/db`, `next/*`, or the
Anthropic SDK. It is pure TypeScript so it stays unit-testable and cannot drag
server-only or SDK code into a bundle. Inputs (`EngineMember`, `EngineSession`)
are plain data assembled by the API route; races are passed in as
`isRace: true`, never queried here.

## Taxonomy mapping (`taxonomy.ts`)

Maps the app's **existing** workout vocabulary onto compatibility classes — no
parallel enum is introduced.

| workout `type`                    | `hr_zone` | → CompatClass       |
|-----------------------------------|-----------|---------------------|
| `recovery`, `easy`                | z1–z2     | `recovery_easy`     |
| `long_run`, `long`                | —         | `long`              |
| `tempo`, `threshold`              | z3–z4     | `threshold_tempo`   |
| `interval(s)`                     | z5        | `intervals`         |
| `cross_training`, `strength`, `cross` | —     | `strength_cross`    |
| `rest`, `race` (or `isRace`)      | —         | `rest_race`         |

Pinned rules: an explicit `hr_zone` **overrides an ambiguous `easy`/`tempo`
label** (the physiological zone is the stimulus). Structural types
(`long_run`, `interval`, `cross_training`, `rest`) always win over `hr_zone`.
Unknown type + no hr_zone → `null` → never matched.

## Merge matrix (`matrix.ts` — config, not logic)

| CompatClass       | Mode(s)                                   | Rule |
|-------------------|-------------------------------------------|------|
| `recovery_easy`   | `SHARED_PACE`                             | together at the slowest member's easy pace |
| `long`            | `SHARED_EASY_SEGMENT`                      | share easy km, quality/goal-pace segments split |
| `threshold_tempo` | `SHARED` if spread ≤ band, else `PARALLEL_TIME_BASED` | same route, own threshold |
| `intervals`       | `PARALLEL_SAME_STRUCTURE`                 | identical skeleton (6×1000), own pace, track — **never a shared pace** |
| `strength_cross`  | `COLOCATED_OPTIONAL`                       | same location possible, not "runnable" |
| `rest_race`       | none                                       | never matched |

`THRESHOLD_SHARE_BAND_SEC` (default 15 s/km) is the only tunable — change it
here, not in the matcher.

## Pace-band derivation (`pace-band.ts`)

Pace is **sec/km**, and in stored zone maps **`min` is the SLOWER bound**
(larger number) — e.g. zone1 `{min: 405, max: 346}`. All helpers take
`Math.max`/`Math.min` of the raw values rather than trusting the field names,
so inverted data is handled. A member's easy band = union of pace zones 1–2;
without `pace_zones` we derive them from `threshold_pace`; without either the
member can only join type-based modes (`PARALLEL_SAME_STRUCTURE`,
`COLOCATED_OPTIONAL`), never a pace-shared one. Shared easy pace = the slowest
member's typical easy pace, restricted to members whose own band contains it.

## Short-key boundary

`recommendationWorkout` is persisted in short-key form (`t`/`km`/`min`/…). The
engine only accepts long-key `WorkoutDetails`. Normalization happens at the API
boundary via `@/server/services/workout-normalize.ts`
(`resolveEffectiveWorkout`, precedence final → recommendation(expanded) →
planned). Never feed raw DB JSON to the engine.

## Adding a new merge mode

1. Add the `MergeMode` to `types.ts`.
2. Add/adjust the `MERGE_MATRIX` entry in `matrix.ts` (`allowedModes`, `paceSharing`).
3. **Write the guardrail test first** in `__tests__/guardrails.test.ts`.
4. Extend `assertStimulusPreserved` so the invariant holds for the new mode.
5. Implement the cluster resolution in `match-week.ts`.
6. Add German note templates (`full` + `visibilitySafe`) in `notes.ts`.

## Seed ↔ test fixture

`__tests__/fixtures/sub77-week.ts` is the single source of truth for both the
engine's pinned expectations and `scripts/seed-club.ts`. They cannot drift —
edit the fixture, both follow.
