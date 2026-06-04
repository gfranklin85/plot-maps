/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
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
