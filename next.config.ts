import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// The version comes from package.json so there is exactly one place to bump it.
// Read here rather than imported, because importing JSON into the config pulls
// the whole file into the client bundle.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

// Render exposes the deployed commit to the build. Absent locally, which is
// correct — a dev build has no meaningful commit to point at.
const commit = process.env.RENDER_GIT_COMMIT ?? "";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "mammoth", "@garmin/fitsdk", "node-ical"],
  typedRoutes: false,
  // Inlined at build time. Both are public by nature: the version is printed in
  // the UI and the commit is already visible in a public repo.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_COMMIT: commit,
  },
};

export default config;
