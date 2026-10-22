import withBundleAnalyzer from "@next/bundle-analyzer";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No basePath: the app serves from the root, so http://localhost:3000/ works.
  // Set basePath: "/ams" (and NEXT_PUBLIC_BASE_PATH=/ams) when it is deployed behind a
  // path prefix on nginx.

  // Enable standalone output for Docker
  output: "standalone",

  // The build folder — ".next" as always; NEXT_DIST_DIR lets a production build be made beside
  // a running dev server (e.g. NEXT_DIST_DIR=.next-prod) without either disturbing the other.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Keep trailing slashes to prevent redirect loops with nginx
  trailingSlash: true,

  images: {
    domains: ["localhost"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compress: true,
  /*
   * OFF: in development Strict Mode runs every effect twice, so each screen called every API
   * twice. Each API is now called once. (Production builds never doubled them.)
   */
  reactStrictMode: false,

  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    optimizeCss: false,
  },

  // The browser calls /api/* (see API_BASE_URL in src/config/api.js) and this hands it to
  // the Spring Boot backend. Going through a rewrite rather than calling the backend host
  // directly keeps the request same-origin, so no CORS preflight and no hard-coded host in
  // the bundle.
  //
  // The backend serves from the root (no server.servlet.context-path), so the prefix is
  // stripped rather than translated: /api/login -> http://localhost:8080/login.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${backendUrl}/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
