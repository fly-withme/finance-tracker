/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Canvas-Alias beibehalten
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    // SVG-Regel hinzufügen
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    return config;
  },
}

export default nextConfig;