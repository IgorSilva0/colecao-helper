/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  reactCompiler: true,
};

export default nextConfig;
