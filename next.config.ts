import type { NextConfig } from 'next';
import type { Configuration as WebpackConfig } from 'webpack';

const nextConfig: NextConfig = {
  webpack: (config: WebpackConfig): WebpackConfig => {
    return {
      ...config,
      experiments: {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      },
      module: {
        ...config.module,
        rules: [
          ...(config.module?.rules || []),
          {
            test: /\.wasm$/,
            type: 'asset/resource',
          },
          {
            test: /\.worker\.(js|ts)$/,
            use: {
              loader: 'worker-loader',
              options: {
                filename: 'static/[hash].worker.js',
                publicPath: '/_next/',
              },
            },
          },
        ],
      },
      output: {
        ...config.output,
        publicPath: '/_next/',
        globalObject: 'self',
      },
    };
  },
  experimental: {
    optimizePackageImports: ['onnxruntime-web'],
  },
};

export default nextConfig;