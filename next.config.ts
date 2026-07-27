import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep child_process spawning of game/flux-recnet out of the webpack graph
  serverExternalPackages: [],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "media.giphy.com",
      },
      {
        protocol: "https",
        hostname: "i.giphy.com",
      },
    ],
  },
  webpack: (config) => {
    // Don't try to bundle Flux RecNet scripts if any path slips through
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
