# Phase 1C-audio — Review Audio → public R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store and serve review voice clips from a **public** Cloudflare R2 bucket on a custom domain (`media.sense.fans`) when running on Workers, while falling back to Vercel Blob anywhere the bucket isn't bound (local Bun, pre-cutover). The stored value stays a full URL, so the browser `<audio>` element and every API response that returns `audioUrl` are unchanged.

**Architecture:** Audio is media, so it is served **directly from R2's edge** (public bucket + custom domain, free egress, native HTTP Range for seeking) rather than proxied through the Worker. A new `audio-store` module owns audio writes: a `MEDIA` R2 bucket binding (write-only from the Worker) is threaded in via `setMediaBucket(bucket)`; `putAudioAsset` validates the clip, writes to R2, and returns the public URL `${MEDIA_PUBLIC_BASE}/${key}`. Reads never touch the server. A one-shot internal-gated endpoint copies existing Vercel audio into R2 and rewrites `review.audioUrl`. This bucket is **separate** from the private `cue-assets` images bucket (different access model).

**Tech Stack:** Cloudflare R2 (public bucket + custom domain), Elysia, Drizzle, `@vercel/blob` (fallback only), Bun test.

---

## Storage model after 1C-audio

| `review.audioUrl` value | When | Played by |
|---|---|---|
| `https://media.sense.fans/reviews/<uid>/<rid>.webm` | Workers uploads + migrated rows | browser, directly from R2 edge |
| `https://…blob.vercel-storage.com/reviews/…` | local/Vercel uploads, un-migrated | browser, directly from Vercel |

Keys are unchanged from `buildReviewAudioBlobKey` (`reviews/<uid>/<rid>.<ext>`), so migration is a 1:1 copy.

## File Structure

- **Create** `apps/server/src/lib/audio-store.ts` — `putAudioAsset` / `setMediaBucket` / `mediaPublicUrl` / `putRawToMedia`.
- **Create** `apps/server/src/lib/audio-store.test.ts` — unit tests.
- **Modify** `packages/env/src/server.ts` — add `MEDIA_PUBLIC_BASE`.
- **Modify** `apps/server/src/worker.ts` — `setMediaBucket(env.MEDIA)` + `MEDIA` on `Env`.
- **Modify** `apps/server/wrangler.jsonc` — `MEDIA` r2 binding + `MEDIA_PUBLIC_BASE` var.
- **Modify** `apps/server/src/routes/reviews.ts` — upload uses `putAudioAsset`.
- **Modify** `apps/server/src/routes/admin-assets.ts` — add `/migrate-audio`.

---

### Task 1: `audio-store` module (TDD)

**Files:**
- Create: `apps/server/src/lib/audio-store.ts`
- Test: `apps/server/src/lib/audio-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/audio-store.test.ts`:

```ts
import { afterEach, describe, expect, mock, test } from "bun:test";

// Hermetic: stub env so importing the module does not validate the real schema.
mock.module("@still/env/server", () => ({
	env: { MEDIA_PUBLIC_BASE: "https://media.test" },
}));

const { mediaPublicUrl, putAudioAsset, setMediaBucket } = await import(
	"./audio-store"
);

afterEach(() => setMediaBucket(null));

describe("mediaPublicUrl", () => {
	test("joins base + key without double slash", () => {
		expect(mediaPublicUrl("https://media.test/", "reviews/u1/r1.webm")).toBe(
			"https://media.test/reviews/u1/r1.webm",
		);
		expect(mediaPublicUrl("https://media.test", "reviews/u1/r1.webm")).toBe(
			"https://media.test/reviews/u1/r1.webm",
		);
	});
});

describe("putAudioAsset", () => {
	test("writes to the bound bucket and returns the public URL", async () => {
		let putKey = "";
		setMediaBucket({
			put: async (key: string) => {
				putKey = key;
				return undefined;
			},
		});
		const file = new File([new Uint8Array([1, 2, 3])], "clip.webm", {
			type: "audio/webm",
		});
		const result = await putAudioAsset(
			"reviews/u1/r1.webm",
			file,
			1000,
		);
		expect(putKey).toBe("reviews/u1/r1.webm");
		expect(result).toEqual({
			url: "https://media.test/reviews/u1/r1.webm",
			mimeType: "audio/webm",
		});
	});

	test("rejects an invalid clip before touching storage", async () => {
		setMediaBucket({ put: async () => undefined });
		const file = new File([new Uint8Array([1])], "x.txt", {
			type: "text/plain",
		});
		const result = await putAudioAsset("reviews/u1/r1.txt", file, 1000);
		expect("error" in result).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/audio-store.test.ts`
Expected: FAIL — `Cannot find module './audio-store'`

- [ ] **Step 3: Implement**

Create `apps/server/src/lib/audio-store.ts`:

```ts
import { env } from "@still/env/server";

import {
	assertReviewAudioUpload,
	type ReviewAudioMimeType,
} from "./review-audio";
import { vercelBlobAudioPut } from "./vercel-blob-audio-put";

/** Minimal public-R2 surface (write-only; reads happen at the custom domain). */
export interface MediaBucket {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | string,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
}

let _bucket: MediaBucket | null = null;

/** Called once per request from the Workers entry. `null` → Vercel Blob fallback. */
export function setMediaBucket(bucket: MediaBucket | null): void {
	_bucket = bucket;
}

/** Join the public base and an object key into a browser-playable URL. */
export function mediaPublicUrl(base: string, key: string): string {
	return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export type PutAudioResult =
	| { url: string; mimeType: ReviewAudioMimeType }
	| { error: string; code: string; hint?: string };

/**
 * Upload a validated voice clip. On Workers (bucket bound) writes to the public
 * media bucket and returns its public URL. Otherwise falls back to Vercel Blob.
 */
export async function putAudioAsset(
	key: string,
	file: File,
	durationMs: number,
): Promise<PutAudioResult> {
	const check = assertReviewAudioUpload({
		size: file.size,
		type: file.type,
		durationMs,
	});
	if (!check.ok) return { error: check.message, code: check.code };

	if (_bucket) {
		const base = env.MEDIA_PUBLIC_BASE;
		if (!base) {
			return {
				error: "MEDIA_PUBLIC_BASE is not set",
				code: "MEDIA_UNCONFIGURED",
				hint: "Set MEDIA_PUBLIC_BASE (e.g. https://media.sense.fans) on the Worker.",
			};
		}
		try {
			await _bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: check.mimeType },
			});
			return { url: mediaPublicUrl(base, key), mimeType: check.mimeType };
		} catch (err) {
			console.error("[audio-store] r2 put failed", err);
			return { error: "Audio upload failed", code: "R2_UPLOAD_FAILED" };
		}
	}

	return vercelBlobAudioPut(key, file, durationMs);
}

/** Migration helper: write raw bytes to the bound media bucket. False when no bucket. */
export async function putRawToMedia(
	key: string,
	bytes: ArrayBuffer,
	contentType: string,
): Promise<boolean> {
	if (!_bucket) return false;
	await _bucket.put(key, bytes, { httpMetadata: { contentType } });
	return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/audio-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/audio-store.ts apps/server/src/lib/audio-store.test.ts
git commit -m "feat(server): add public-R2 audio-store with Vercel fallback"
```

---

### Task 2: Add `MEDIA_PUBLIC_BASE` to server env

**Files:**
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Add the var.** In `packages/env/src/server.ts`, in the `serverEnv` object near the other Cloudflare keys (`REALTIME_WORKER_URL`, etc.), add:

```ts
	// Public base URL of the R2 media bucket (review audio), e.g.
	// https://media.sense.fans. When unset, audio falls back to Vercel Blob.
	MEDIA_PUBLIC_BASE: optionalUrl(),
```

- [ ] **Step 2: Typecheck env package**

Run: `./node_modules/.bin/tsc -p packages/env/tsconfig.json --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/env/src/server.ts
git commit -m "feat(env): add MEDIA_PUBLIC_BASE for R2 audio bucket"
```

---

### Task 3: Bind the MEDIA bucket on the Worker

**Files:**
- Modify: `apps/server/src/worker.ts`
- Modify: `apps/server/wrangler.jsonc`

- [ ] **Step 1: Update `worker.ts`.** Add the media binding to `Env` and set it per request:

```ts
import { setDbConnectionString } from "@still/db";

import type { AssetsBucket } from "./lib/asset-store";
import { setAssetsBucket } from "./lib/asset-store";
import type { MediaBucket } from "./lib/audio-store";
import { setMediaBucket } from "./lib/audio-store";
import { app } from "./server/app";

export interface Env {
	HYPERDRIVE?: { connectionString: string };
	ASSETS?: AssetsBucket;
	MEDIA?: MediaBucket;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		setAssetsBucket(env.ASSETS ?? null);
		setMediaBucket(env.MEDIA ?? null);
		return app.fetch(request);
	},
};
```

- [ ] **Step 2: Update `apps/server/wrangler.jsonc`.** Add a second entry to the existing `r2_buckets` array, and add a `vars` block:

```jsonc
	"r2_buckets": [
		{ "binding": "ASSETS", "bucket_name": "cue-assets" },
		{ "binding": "MEDIA", "bucket_name": "cue-media" }
	],
	"vars": {
		// Public custom domain of the cue-media bucket; bound in Plan 1D.
		"MEDIA_PUBLIC_BASE": "https://media.sense.fans"
	}
```

(Keep the existing `hyperdrive` array; mind JSONC commas.)

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "worker\.ts|audio-store"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/worker.ts apps/server/wrangler.jsonc
git commit -m "feat(server): bind public R2 MEDIA bucket + MEDIA_PUBLIC_BASE"
```

---

### Task 4: Review upload uses `putAudioAsset`

**Files:**
- Modify: `apps/server/src/routes/reviews.ts`

- [ ] **Step 1: Swap the import.** Replace `import { vercelBlobAudioPut } from "../lib/vercel-blob-audio-put";` (line ~64) with:

```ts
import { putAudioAsset } from "../lib/audio-store";
```

- [ ] **Step 2: Swap the call.** In the `/:id/audio` POST handler (~line 297), change:

```ts
			const uploaded = await vercelBlobAudioPut(key, file, durationMs);
```
to:

```ts
			const uploaded = await putAudioAsset(key, file, durationMs);
```

Everything below — the `"error" in uploaded` branch (with `BLOB_UNCONFIGURED`/`BLOB_ACCESS_MISMATCH` handling, which still applies to the Vercel fallback and now also `MEDIA_UNCONFIGURED`/`R2_UPLOAD_FAILED`) and the `db.update(review).set({ audioUrl: uploaded.url, … })` — stays unchanged: `putAudioAsset` returns the same `{ url, mimeType } | { error, code, hint? }` shape.

- [ ] **Step 3: Verify + typecheck**

Run: `grep -n "vercelBlobAudioPut" apps/server/src/routes/reviews.ts`
Expected: no output.
Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep "reviews.ts"`
Expected: no output.

- [ ] **Step 4: Run review tests + commit**

Run: `bun test apps/server/src/routes/reviews.test.ts 2>&1 | tail -5` (if present) — no new failures. If it mocks `../lib/vercel-blob-audio-put`, update the mock to `../lib/audio-store` exposing `putAudioAsset` with the same return shape, preserving the test's intent.
```bash
git add apps/server/src/routes/reviews.ts apps/server/src/routes/reviews.test.ts
git commit -m "refactor(server): store review audio via public R2 audio-store"
```

---

### Task 5: Audio migration endpoint

**Files:**
- Modify: `apps/server/src/routes/admin-assets.ts`

- [ ] **Step 1: Add imports.** In `apps/server/src/routes/admin-assets.ts`, add `review` to the `@still/db` import, `env` is already imported, and add the media helpers:

```ts
import { db, list, profile, review, user } from "@still/db";
```
```ts
import { mediaPublicUrl, putRawToMedia } from "../lib/audio-store";
```

- [ ] **Step 2: Add the `/migrate-audio` route.** Chain a second `.post` onto `adminAssetsRoute` (after `/migrate-images`):

```ts
	.post(
		"/migrate-audio",
		async ({ request, query, status }) => {
			if (!authed(request.headers.get("Authorization"))) {
				return status(401, "Unauthorized");
			}
			const base = env.MEDIA_PUBLIC_BASE;
			if (!base) return status(503, "MEDIA_PUBLIC_BASE not set");
			const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);

			const rows = await db
				.select({
					id: review.id,
					url: review.audioUrl,
					mime: review.audioMimeType,
				})
				.from(review)
				.where(
					and(
						isNotNull(review.audioUrl),
						like(review.audioUrl, `%${VERCEL_HOST}%`),
					),
				)
				.limit(limit);

			let migrated = 0;
			for (const r of rows) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				const upstream = await fetch(r.url);
				if (!upstream.ok || !upstream.body) {
					console.error("[migrate-audio] fetch failed", r.url);
					continue;
				}
				const bytes = await upstream.arrayBuffer();
				const contentType =
					r.mime ?? upstream.headers.get("content-type") ?? "audio/webm";
				if (await putRawToMedia(key, bytes, contentType)) {
					await db
						.update(review)
						.set({ audioUrl: mediaPublicUrl(base, key) })
						.where(eq(review.id, r.id));
					migrated++;
				}
			}

			return { migrated, remaining: rows.length - migrated };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	);
```

(Confirm `review` is exported from `@still/db` and has `audioUrl` + `audioMimeType` columns — `audioUrl` is `activity.ts:114`. If the audio columns live on a differently-named table export, adapt and report.)

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "admin-assets|audio-store"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/admin-assets.ts
git commit -m "feat(server): add internal-gated review-audio → R2 migration route"
```

---

### Task 6: Verification — bundle + suite + typecheck

**Files:** none (verification only).

- [ ] **Step 1: Workers bundle still builds.**

Run: `cd apps/server && bun run cf:dry-run; cd ../..`
Expected: exit 0; bindings list now shows `ASSETS`, `MEDIA`, and `HYPERDRIVE`. Then `rm -rf apps/server/.wrangler-dryrun`.

- [ ] **Step 2: audio-store tests**

Run: `bun test apps/server/src/lib/audio-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Full server suite — no new failures**

Run: `bun test apps/server/src`
Expected: baseline pass/fail set unchanged aside from the 3 new audio-store passes.

- [ ] **Step 4: Server + env typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit` and `./node_modules/.bin/tsc -p packages/env/tsconfig.json --noEmit`
Expected: no new errors vs. baseline.

---

## Self-Review

- **Spec coverage:** Completes the Blob→R2 migration for **review audio** via a public bucket (Option A — chosen for free media egress, native Range support, and zero client change since `audioUrl` stays a full URL). Images remain on the private proxied `cue-assets` bucket from Plan 1C; audio uses a separate public `cue-media` bucket.
- **Placeholder scan:** `wrangler.jsonc` `bucket_name: "cue-media"` and `MEDIA_PUBLIC_BASE: "https://media.sense.fans"` are provisioned/confirmed in Plan 1D (labeled).
- **Type consistency:** `setMediaBucket`, `MediaBucket`, `putAudioAsset`, `mediaPublicUrl`, `putRawToMedia` defined in Task 1 and consumed in worker.ts (Task 3), reviews.ts (Task 4), admin-assets.ts (Task 5). `putAudioAsset` returns the exact `{ url, mimeType } | { error, code, hint? }` shape `vercelBlobAudioPut` returned, so the reviews route is a one-line swap.
- **Risk:** `reviews.test.ts` may mock `../lib/vercel-blob-audio-put`; Task 4 Step 4 redirects that mock to `../lib/audio-store`. After this plan, `@vercel/blob` is still used only by the local/Vercel fallbacks (images + audio) — it leaves the prod path entirely; the dependency can be dropped once local dev no longer needs Vercel Blob.

## Next plan

- **1D — Cutover** (the only remaining phase): `wrangler hyperdrive create`, `wrangler r2 bucket create cue-assets` + `cue-media`, enable public access + bind `media.sense.fans` to `cue-media`, set all secrets + `MEDIA_PUBLIC_BASE`, bind `api.sense.fans`, deploy, run `POST /api/admin/assets/migrate-images` and `/migrate-audio` in a loop until `remaining: 0`, flip web `NEXT_PUBLIC_SERVER_URL`/`API_REWRITE_ORIGIN` + realtime `SERVER_ORIGIN`, prod smoke, retire the Vercel server.
