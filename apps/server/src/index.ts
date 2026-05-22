/**
 * Vercel Elysia entry: re-export the pre-bundled handler produced by `bun run build:vercel`.
 * Workspace packages are inlined into vercel-handler.mjs (no runtime @still package resolution).
 */
import { Elysia } from "elysia";

// Satisfies Vercel Elysia entrypoint detection; runtime app is the bundled handler below.
void Elysia;

export { default } from "./vercel-handler.mjs";
