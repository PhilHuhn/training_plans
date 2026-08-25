/**
 * Banister fitness / fatigue / form, as a series of days.
 *
 * Lifted out of the dashboard route so the measured past and the projected next
 * week run through one implementation. Two copies of an exponential decay is
 * exactly the kind of thing that drifts by a rounding rule and leaves the
 * forecast quietly discontinuous with the history it continues.
 *
 * Pure — no db, no `server-only` — so the maths is testable on its own.
 */

/** Fitness: a 42-day exponential average of daily load. */
export const CTL_TIME_CONSTANT_DAYS = 42;
/** Fatigue: a 7-day exponential average — the same load, forgotten faster. */
export const ATL_TIME_CONSTANT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LoadPoint {
  date: string;
  trimp: number;
  /** Fitness (CTL). */
  ctl: number;
  /** Fatigue (ATL). */
  atl: number;
  /** Form (TSB) — fitness carried into the day, minus fatigue. */
  tsb: number;
  /**
   * True where the day's load came from the plan rather than from something
   * that actually happened. The chart draws these dashed; a forecast rendered
   * identically to measurement is a lie by styling.
   */
  projected: boolean;
}

export interface LoadSeriesInput {
  /** ISO day → total TRIMP for that day, from activities and/or planned sessions. */
  trimpByDay: Map<string, number>;
  /** First day to compute (the warm-up start, usually well before `from`). */
  computeFrom: Date;
  /** First day to actually emit — earlier days only seed the averages. */
  emitFrom: Date;
  /** Last day to emit, inclusive. */
  emitTo: Date;
  /** Days from here on are marked `projected`. Omit for none. */
  projectFrom?: Date;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Midnight UTC of the day a timestamp falls in, as epoch ms. */
function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Walks the range day by day, decaying both averages and folding in that day's
 * load.
 *
 * Note the ordering: `tsb` is read **before** the day's load is applied, so form
 * is the freshness an athlete carries *into* the session rather than a figure
 * that already accounts for it. That is the conventional reading, and it is what
 * the route did before this was extracted — preserved deliberately.
 */
export function buildLoadSeries(input: LoadSeriesInput): LoadPoint[] {
  const { trimpByDay, computeFrom, emitFrom, emitTo, projectFrom } = input;

  const ctlDecay = Math.exp(-1 / CTL_TIME_CONSTANT_DAYS);
  const atlDecay = Math.exp(-1 / ATL_TIME_CONSTANT_DAYS);

  // Every bound is snapped to UTC midnight before the walk starts. Callers pass
  // `new Date()`-derived values that carry a time of day, and stepping by
  // exactly 24h from 16:40 means no step ever lands on a midnight boundary — so
  // an inclusive `emitTo` at midnight silently loses the last day. That cost a
  // "7-day forecast" its seventh day.
  const startMs = startOfUtcDay(computeFrom);
  const emitFromMs = startOfUtcDay(emitFrom);
  const emitToMs = startOfUtcDay(emitTo);
  const projectFromMs = projectFrom ? startOfUtcDay(projectFrom) : Number.POSITIVE_INFINITY;

  const points: LoadPoint[] = [];
  let ctl = 0;
  let atl = 0;

  for (let t = startMs; t <= emitToMs; t += DAY_MS) {
    const day = isoDay(new Date(t));
    const trimp = trimpByDay.get(day) ?? 0;
    const tsb = ctl - atl;

    ctl = ctl * ctlDecay + trimp * (1 - ctlDecay);
    atl = atl * atlDecay + trimp * (1 - atlDecay);

    if (t >= emitFromMs) {
      points.push({
        date: day,
        trimp: round1(trimp),
        ctl: round1(ctl),
        atl: round1(atl),
        tsb: round1(tsb),
        projected: t >= projectFromMs,
      });
    }
  }

  return points;
}

/**
 * Splits each metric into a measured key and a projected key so the chart can
 * dash the tail.
 *
 * Recharts cannot style part of one series, so the forecast has to be a second
 * line. The boundary day is written to **both** — without it the two lines share
 * no x position and the chart shows a one-day gap where they should meet.
 */
/**
 * Deliberately not `extends LoadPoint`: every metric here is nullable, because
 * a point belongs to one line or the other (or, at the boundary, to both). The
 * nulls are the mechanism — Recharts ends a line at a null rather than
 * interpolating across it — so they belong in the type rather than behind a
 * cast.
 */
export interface SplitLoadPoint {
  date: string;
  trimp: number;
  projected: boolean;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  ctl_projected: number | null;
  atl_projected: number | null;
  tsb_projected: number | null;
}

export function splitForChart(points: LoadPoint[]): SplitLoadPoint[] {
  const firstProjected = points.findIndex((p) => p.projected);
  // The last measured day, which both lines must include. -1 when nothing is
  // projected (then no point is a boundary and every projected key stays null).
  const boundary = firstProjected === -1 ? -1 : firstProjected - 1;

  return points.map((p, i) => {
    const onProjectedLine = p.projected || i === boundary;
    return {
      date: p.date,
      trimp: p.trimp,
      projected: p.projected,
      ctl: p.projected ? null : p.ctl,
      atl: p.projected ? null : p.atl,
      tsb: p.projected ? null : p.tsb,
      ctl_projected: onProjectedLine ? p.ctl : null,
      atl_projected: onProjectedLine ? p.atl : null,
      tsb_projected: onProjectedLine ? p.tsb : null,
    };
  });
}
