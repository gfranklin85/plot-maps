/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only: disable webpack's persistent cache. On Windows, Next 14.2's
  // dev cache repeatedly drops the app/layout.css chunk after HMR cycles
  // (page renders with browser-default Times — recurred 3x on 2026-07-12).
  // Rebuilds are a bit slower; chunk manifests stay consistent.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },
  async rewrites() {
    // PostHog now points directly at its cloud host (see src/lib/posthog.ts),
    // so the /ingest reverse-proxy rewrites are no longer needed. Kept empty.
    return [];
  },
  // PostHog proxy should not follow redirects
  skipTrailingSlashRedirect: true,
  // Long-lived immutable cache for in-world 3D marker/glb assets.
  // Google's gmp-model-3d-interactive revalidates its src ~1x/sec PER
  // mounted instance; with 12+ pins that produced a ~10 req/sec 304
  // storm against /assets/markers/plot-pin.glb. `immutable` makes the
  // browser serve from cache without a network round-trip, killing the
  // storm. Safe because these assets are versioned-by-rename, never
  // overwritten in place (status variants edit the .blend → new export).
  async headers() {
    return [
      {
        source: '/assets/markers/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
