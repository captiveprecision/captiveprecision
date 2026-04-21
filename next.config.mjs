const isDevelopment = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Keep dev artifacts separate so HMR does not reuse stale chunks from production builds.
  distDir: isDevelopment ? ".next-dev" : ".next"
};

export default nextConfig;
