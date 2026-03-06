import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet and React 18 Strict Mode are incompatible:
  // Strict Mode double-invokes effects in dev, causing Leaflet to throw
  // "Map container is already initialized" on the second mount.
  // Disabling Strict Mode here is the standard fix — does not affect production.
  reactStrictMode: false,
};

export default nextConfig;
