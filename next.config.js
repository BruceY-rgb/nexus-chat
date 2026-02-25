/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 实验性功能或额外配置
  experimental: {
    // 如果需要额外的代理配置，可以在这里添加
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