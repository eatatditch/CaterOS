/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cateros/ui', '@cateros/lib', '@cateros/db'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        // Lead-capture iframe embeds — must be embeddable on any site.
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        // Hosted widget — loadable as <script> from any origin.
        source: '/widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        // Public API endpoints — CORS already handled in handlers; belt & braces.
        source: '/api/public/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ];
  },
};

export default nextConfig;
