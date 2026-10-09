import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  },
  transpilePackages: ["@maia/db"],
};

export default nextConfig;
