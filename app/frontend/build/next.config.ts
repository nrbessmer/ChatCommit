import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  webpack: (config: any) => {   // ← annotate as any
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },

  async rewrites() {
    return [
      { source: '/api/branch/:id',       destination: 'https://chatcommit.fly.dev/branch/:id' },
      { source: '/api/branch/:id/commits',destination: 'https://chatcommit.fly.dev/branch/:id/commits' },
      { source: '/api/branch/',          destination: 'https://chatcommit.fly.dev/branch/' },
      { source: '/api/commit/:path*',     destination: 'https://chatcommit.fly.dev/commit/:path*' },
      { source: '/api/rollback/:path*',   destination: 'https://chatcommit.fly.dev/rollback/:path*' },
      { source: '/api/tag/:path*',        destination: 'https://chatcommit.fly.dev/tag/:path*' },
      { source: '/api/merge/:path*',      destination: 'https://chatcommit.fly.dev/merge/:path*' },
    ];
  },
};

export default nextConfig;
