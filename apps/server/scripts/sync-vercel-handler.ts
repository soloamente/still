/**
 * Legacy helper — `build:vercel` now runs `bun build` straight to `src/index.mjs`.
 * Kept so old docs/scripts references do not break; safe to delete once unused.
 */
console.log(
	"[vercel] sync-vercel-handler.ts is deprecated; build:vercel writes src/index.mjs directly.",
);
