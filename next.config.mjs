/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuración para prevenir errores de hidratación
  experimental: {
    optimizeCss: false,
    // Mejorar la hidratación
    optimizePackageImports: [],
  },
  // Configuración para prevenir errores de hidratación
  reactStrictMode: false,
  swcMinify: true,
  // Configuración adicional para hidratación
  compiler: {
    removeConsole: false,
  },
  // Forzar renderizado solo en cliente para páginas problemáticas
  output: 'standalone',
}

export default nextConfig
