import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.DEPLOY ? "/tonal-guitar" : "",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(nextConfig);
