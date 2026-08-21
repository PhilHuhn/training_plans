// drizzle-kit push asks for confirmation before it applies anything. A build
// container has no TTY, so the prompt resolves to "No, abort" and the deploy
// silently ships without the schema. Pass --force on Render, where answering
// is impossible; keep the prompt locally, where --force could truncate tables.
import { spawnSync } from "node:child_process";

const nonInteractive = Boolean(process.env.RENDER || process.env.CI);
const args = ["push", ...(nonInteractive ? ["--force"] : []), ...process.argv.slice(2)];

const result = spawnSync("drizzle-kit", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Failed to run drizzle-kit: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
