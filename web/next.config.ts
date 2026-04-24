import type { NextConfig } from "next";
import path from "path";

const backendTarget = process.env.BACKEND_PROXY_TARGET ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${backendTarget.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
