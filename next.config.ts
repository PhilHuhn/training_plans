import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "mammoth", "@garmin/fitsdk", "node-ical"],
  typedRoutes: false,
};

export default config;
