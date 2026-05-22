/**
 * Vercel Elysia entry (detection + runtime shim).
 * The real app is pre-bundled in index.mjs (see build:vercel); this file only
 * satisfies Vercel's "imports elysia" check and re-exports the bundle on Node.
 */
import { Elysia } from "elysia";

void Elysia;

export { default } from "./index.mjs";
