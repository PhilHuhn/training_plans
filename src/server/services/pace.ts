import "server-only";

// Implementations live in src/lib/pace-utils.ts (pure, engine/test-safe);
// this module keeps the server-side import path stable.
export { formatPace, parsePace, formatGoalTime } from "@/lib/pace-utils";
