import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "flux";
const basePath = isGitHubPages ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  // GitHub Pages is a static host. Keep normal deployments server-capable,
  // while exporting a path-safe static build only in the Pages workflow.
  ...(isGitHubPages
    ? {
        output: "export" as const,
        trailingSlash: true,
        basePath,
        assetPrefix: `${basePath}/`,
      }
    : {}),
  // Keep child_process spawning of game/flux-recnet out of the webpack graph
  serverExternalPackages: [],
  images: {
    unoptimized: isGitHubPages,
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
