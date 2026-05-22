import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Copy the bundled serverless entry next to `src/index.ts` for Vercel's Elysia detector.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, "dist", "vercel.mjs");
const to = join(root, "src", "vercel-handler.mjs");

copyFileSync(from, to);
console.log(`[vercel] synced ${from} -> ${to}`);
