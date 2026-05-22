import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Vercel Elysia detects src/index.* — use a single bundled index.mjs (includes elysia + workspace packages).
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "dist", "vercel.mjs");
const to = join(root, "src", "index.mjs");

copyFileSync(from, to);
console.log(`[vercel] synced ${from} -> ${to}`);
