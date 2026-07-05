import "server-only";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Some shells inject secrets (e.g. ANTHROPIC_API_KEY) as empty strings, which
// then beat dotenv-loaded values because Next's loader does not override
// pre-existing process.env entries. Read .env.local / .env ourselves and fall
// back to those values whenever process.env is missing OR empty.
function loadDotEnv(path: string): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), path), "utf8");
    const out: Record<string, string> = {};
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv: Record<string, string> = {
  ...loadDotEnv(".env"),
  ...loadDotEnv(".env.local"), // .env.local wins
};

function readEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;
  return fileEnv[key];
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SECRET_KEY: z.string().min(16, "SECRET_KEY must be at least 16 chars"),
  STRAVA_CLIENT_ID: z.string().default(""),
  STRAVA_CLIENT_SECRET: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  BASE_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: readEnv("DATABASE_URL"),
  SECRET_KEY: readEnv("SECRET_KEY"),
  STRAVA_CLIENT_ID: readEnv("STRAVA_CLIENT_ID"),
  STRAVA_CLIENT_SECRET: readEnv("STRAVA_CLIENT_SECRET"),
  ANTHROPIC_API_KEY: readEnv("ANTHROPIC_API_KEY"),
  BASE_URL: readEnv("BASE_URL"),
});

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. See .env.example.");
}

export const env = parsed.data;
