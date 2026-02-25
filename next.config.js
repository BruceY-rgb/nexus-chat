/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Experimental features or additional configuration
  experimental: {
    // If additional proxy configuration is needed, it can be added here
  },

  // Rewrite /docs to /docs/index.html for static HTML documentation
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: '/docs/index.html',
      },
      {
        source: '/docs/',
        destination: '/docs/index.html',
      },
    ];
  },
};

module.exports = nextConfig;