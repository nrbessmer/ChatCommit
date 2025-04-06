const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Preserve existing aliases
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/branch/:path*',
        destination: 'https://chatcommit.fly.dev/branch/:path*',
      },
      {
        source: '/api/commit/:path*',
        destination: 'https://chatcommit.fly.dev/commit/:path*',
      },
      {
        source: '/api/branch/:id/commits',
        destination: 'https://chatcommit.fly.dev/branch/:id/commits',
      },
      // Add more proxy rules here as needed
    ];
  },
};

module.exports = nextConfig;


