import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Match Next.js env precedence: .env.local overrides .env. Use `override` so
// .env.local wins even if drizzle-kit pre-loaded .env into the environment.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
