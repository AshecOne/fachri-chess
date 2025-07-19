import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ashecone.github.io',
        port: '',
        pathname: '/fachri-chess/**',
      },
    ],
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Handle WASM files
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
  experimental: {
    optimizePackageImports: ['onnxruntime-web'],
  },
};

export default nextConfig;