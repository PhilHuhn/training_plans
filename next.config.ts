import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "mammoth", "@garmin/fitsdk"],
  typedRoutes: false,
};

export default config;
