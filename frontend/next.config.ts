const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    // Allows imports like `@/components/...`
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },

  async rewrites() {
    return [
      // Branch list and detail
      {
        source: '/api/branch/:path*',
        destination: 'https://chatcommit.fly.dev/branch/:path*',
      },
      // Commit list by branch
      {
        source: '/api/branch/:id/commits',
        destination: 'https://chatcommit.fly.dev/branch/:id/commits',
      },
      // Single commit detail
      {
        source: '/api/commit/:path*',
        destination: 'https://chatcommit.fly.dev/commit/:path*',
      },
      // Rollback and other routes can be proxied similarly
      {
        source: '/api/rollback/:path*',
        destination: 'https://chatcommit.fly.dev/rollback/:path*',
      },
      {
        source: '/api/tag/:path*',
        destination: 'https://chatcommit.fly.dev/tag/:path*',
      },
      {
        source: '/api/merge/:path*',
        destination: 'https://chatcommit.fly.dev/merge/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
