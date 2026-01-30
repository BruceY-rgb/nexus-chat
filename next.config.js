/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 移除 standalone 模式，使用自定义服务器

  // Nginx 反向代理配置 - 信任代理
  // 这允许 Next.js 识别通过 Nginx 代理的真实客户端 IP
  // 重要：对于生产环境，建议设置具体的 IP 范围而不是使用 true
  // 例如：'10.0.0.0/8' 只信任来自特定网络的请求
  trustProxy: true,

  // 实验性功能或额外配置
  experimental: {
    // 如果需要额外的代理配置，可以在这里添加
  },
};

module.exports = nextConfig;