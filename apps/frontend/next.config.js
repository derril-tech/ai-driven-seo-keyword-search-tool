/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        appDir: true,
    },
    transpilePackages: ['@ai-seo-tool/shared'],
    env: {
        CUSTOM_KEY: process.env.CUSTOM_KEY,
    },
}

module.exports = nextConfig
