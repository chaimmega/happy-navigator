import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://maps.googleapis.com https://overpass-api.de https://overpass.kumi.systems https://api.opentopodata.org https://api.anthropic.com",
            "frame-src 'none'",
          ].join("; "),
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self)",
        },
      ],
    },
  ],
};

export default nextConfig;
