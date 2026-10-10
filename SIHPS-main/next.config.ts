import type { NextConfig } from "next";
import path from "node:path";

const isGithubActions = Boolean(process.env.GITHUB_ACTIONS);
let repoName = "";
if (process.env.GITHUB_REPOSITORY) {
  repoName = process.env.GITHUB_REPOSITORY.replace(/.*?\//, "");
}
const isUserPage = repoName.toLowerCase().endsWith(".github.io");
const basePath = isGithubActions && !isUserPage && repoName ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in the home directory otherwise
  // makes Turbopack infer C:\Users\<user> as the project root.
  turbopack: { root: path.resolve(process.cwd()) },
  // Static export: the demo laptop has no backend and no internet.
  // `npm run build` emits ./out, servable from any static host or `npx serve out`.
  output: "export",
  basePath: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Relative asset paths so ./out also works when served from a subdirectory.
  trailingSlash: true,
};

export default nextConfig;

