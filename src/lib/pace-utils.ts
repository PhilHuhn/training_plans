// Pure pace formatting/parsing shared between server services and the pure
// matching engine (which runs under Vitest). Must stay free of server-only
// imports — src/server/services/pace.ts re-exports these for server code.

/** Format pace as `m:ss` from seconds-per-km. */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm) return "--:--";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse "5:30" → 330. Throws on invalid input. */
export function parsePace(pace: string): number {
  const parts = pace.split(":");
  if (parts.length !== 2) throw new Error(`Invalid pace format: ${pace}`);
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (Number.isNaN(m) || Number.isNaN(s)) throw new Error(`Invalid pace format: ${pace}`);
  return m * 60 + s;
}

/** Format goal time (seconds) → `HH:MM:SS` or `MM:SS`. */
export function formatGoalTime(seconds: number | null | undefined): string {
  if (!seconds) return "N/A";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
