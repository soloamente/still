/**
 * Vercel Elysia entry: re-export the pre-bundled handler produced by `bun run build:vercel`.
 * Workspace packages are inlined into vercel-handler.mjs (no runtime @still package resolution).
 */
export { default } from "./vercel-handler.mjs";
