# Phase 1C — Images → R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve and store profile avatars, profile banners, and list cover images from Cloudflare R2 when running on Workers, while keeping the existing proxy route shapes (`/api/profiles/**`, `/api/lists/**`) and falling back to Vercel Blob everywhere R2 isn't bound (local Bun, pre-cutover Vercel).

**Architecture:** A single `asset-store` module owns image read/write. An R2 bucket binding arrives per-request via the Worker `env` and is threaded in with `setAssetsBucket(bucket)` (mirrors `setDbConnectionString` from 1A). `putImageAsset` writes to R2 and stores the **object key** when the bucket is bound, else falls back to Vercel Blob and stores the URL. `getImageAsset` resolves any stored value — R2 key, legacy `blob.vercel-storage.com` URL, or external OAuth URL — to a streamable body. A one-shot, internal-secret-gated Worker route copies existing Vercel Blob objects into R2 and rewrites the stored DB values to keys (executed in Plan 1D).

**Tech Stack:** Cloudflare R2 (Worker binding), Elysia, Drizzle, `@vercel/blob` (fallback only), Bun test.

**Out of scope:** Review **audio** (`review.audioUrl`) is served by direct public URL, not proxied, so it needs a public R2 domain or a new proxy route + client change — handled in a follow-up plan **1C-audio**. Until then `@vercel/blob` stays a dependency and the audio upload path is unchanged.

---

## Storage model after 1C

| Stored value | Meaning | Read path |
|---|---|---|
| `banners/<uid>/<ts>-<name>` (no scheme) | R2 object key (new Workers uploads + migrated rows) | `bucket.get(key)` |
| `https://…blob.vercel-storage.com/…` | Legacy Vercel Blob URL (local/Vercel uploads, un-migrated) | `@vercel/blob` `get()` |
| `https://…` (other host) | External OAuth headshot | `fetch()` |

Keys are unchanged from today's Vercel Blob keys (`banners/`, `avatars/`, list `cover-images/…`), so migration is a 1:1 copy.

## File Structure

- **Create** `apps/server/src/lib/asset-store.ts` — R2/Vercel image read+write + binding setter.
- **Create** `apps/server/src/lib/asset-store.test.ts` — unit tests (key detection + read routing with a fake bucket).
- **Modify** `apps/server/src/worker.ts` — `setAssetsBucket(env.ASSETS)` per request + `ASSETS` on `Env`.
- **Modify** `apps/server/wrangler.jsonc` — `r2_buckets` binding.
- **Modify** `apps/server/src/routes/profiles.ts` — banner/avatar upload + the 3 serve routes use `asset-store`.
- **Modify** `apps/server/src/routes/lists.ts` — cover upload + serve use `asset-store`.
- **Create** `apps/server/src/routes/admin-assets.ts` — internal-gated migration route.
- **Modify** `apps/server/src/server/app.ts` — mount the migration route.

`apps/server/src/lib/vercel-blob-image-put.ts` stays — `asset-store`'s fallback reuses it.

---

### Task 1: `asset-store` module (TDD)

**Files:**
- Create: `apps/server/src/lib/asset-store.ts`
- Test: `apps/server/src/lib/asset-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/asset-store.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";

import {
	getImageAsset,
	isR2Key,
	setAssetsBucket,
} from "./asset-store";

afterEach(() => setAssetsBucket(null));

describe("isR2Key", () => {
	test("true for a bare key", () => {
		expect(isR2Key("banners/u1/123-pic.png")).toBe(true);
	});
	test("false for http(s) URLs", () => {
		expect(isR2Key("https://x.blob.vercel-storage.com/a")).toBe(false);
		expect(isR2Key("http://example.com/a.jpg")).toBe(false);
	});
});

describe("getImageAsset routing", () => {
	test("reads an R2 key from the bound bucket", async () => {
		const stream = new ReadableStream();
		setAssetsBucket({
			put: async () => undefined,
			get: async (key: string) => {
				expect(key).toBe("avatars/u1/x.png");
				return { body: stream, httpMetadata: { contentType: "image/png" } };
			},
		});
		const got = await getImageAsset("avatars/u1/x.png");
		expect(got?.contentType).toBe("image/png");
		expect(got?.body).toBe(stream);
	});

	test("returns null when the R2 object is missing", async () => {
		setAssetsBucket({ put: async () => undefined, get: async () => null });
		expect(await getImageAsset("avatars/u1/missing.png")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/asset-store.test.ts`
Expected: FAIL — `Cannot find module './asset-store'`

- [ ] **Step 3: Implement**

Create `apps/server/src/lib/asset-store.ts`:

```ts
import { get as vercelGet } from "@vercel/blob";
import { env } from "@still/env/server";

import { vercelBlobImagePut } from "./vercel-blob-image-put";

/** Minimal R2 surface we use (typed locally so the Bun/Node tsconfig stays clean). */
export interface AssetsBucket {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | string,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
	get(
		key: string,
	): Promise<{
		body: ReadableStream;
		httpMetadata?: { contentType?: string };
	} | null>;
}

let _bucket: AssetsBucket | null = null;

/** Called once per request from the Workers entry. `null` → Vercel Blob fallback. */
export function setAssetsBucket(bucket: AssetsBucket | null): void {
	_bucket = bucket;
}

/** A stored value is an R2 key when it is not an absolute http(s) URL. */
export function isR2Key(value: string): boolean {
	return !/^https?:\/\//i.test(value);
}

export type PutImageResult =
	| { value: string }
	| { error: string; code: string; hint?: string };

/**
 * Upload an image. On Workers (bucket bound) writes to R2 and returns the object
 * KEY. Otherwise falls back to Vercel Blob and returns the blob URL. The returned
 * `value` is what callers persist in the DB column.
 */
export async function putImageAsset(
	key: string,
	file: File,
): Promise<PutImageResult> {
	if (_bucket) {
		try {
			await _bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type || "application/octet-stream" },
			});
			return { value: key };
		} catch (err) {
			console.error("[asset-store] r2 put failed", err);
			return { error: "Asset upload failed", code: "R2_UPLOAD_FAILED" };
		}
	}
	const fallback = await vercelBlobImagePut(key, file);
	if ("error" in fallback) return fallback;
	return { value: fallback.url };
}

export type ImageBody = { body: ReadableStream; contentType: string };

/**
 * Resolve a stored image value to a streamable body. Handles R2 keys (bound
 * bucket), legacy Vercel Blob URLs, and external http(s) URLs (OAuth headshots).
 * Returns null when the asset cannot be resolved.
 */
export async function getImageAsset(value: string): Promise<ImageBody | null> {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (_bucket && isR2Key(trimmed)) {
		const obj = await _bucket.get(trimmed);
		if (!obj) return null;
		return {
			body: obj.body,
			contentType: obj.httpMetadata?.contentType ?? "image/jpeg",
		};
	}

	if (trimmed.includes("blob.vercel-storage.com")) {
		if (!env.BLOB_READ_WRITE_TOKEN) return null;
		const result = await vercelGet(trimmed, {
			access: env.BLOB_STORE_ACCESS,
			token: env.BLOB_READ_WRITE_TOKEN,
		});
		if (!result || result.statusCode !== 200 || !result.stream) return null;
		return { body: result.stream, contentType: result.blob.contentType };
	}

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		const upstream = await fetch(trimmed);
		if (!upstream.ok || !upstream.body) return null;
		return {
			body: upstream.body,
			contentType: upstream.headers.get("content-type") ?? "image/jpeg",
		};
	}

	return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/asset-store.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/asset-store.ts apps/server/src/lib/asset-store.test.ts
git commit -m "feat(server): add R2/Vercel image asset-store with binding setter"
```

---

### Task 2: Wire the R2 binding into the Worker

**Files:**
- Modify: `apps/server/src/worker.ts`
- Modify: `apps/server/wrangler.jsonc`

- [ ] **Step 1: Add `ASSETS` to the Worker `Env` and set it per request.** In `apps/server/src/worker.ts`, update the `Env` interface and the `fetch` body:

```ts
import { setDbConnectionString } from "@still/db";

import type { AssetsBucket } from "./lib/asset-store";
import { setAssetsBucket } from "./lib/asset-store";
import { app } from "./server/app";

export interface Env {
	HYPERDRIVE?: { connectionString: string };
	ASSETS?: AssetsBucket;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		setAssetsBucket(env.ASSETS ?? null);
		return app.fetch(request);
	},
};
```

- [ ] **Step 2: Add the R2 binding to `apps/server/wrangler.jsonc`.** Add a top-level `r2_buckets` array (sibling to `hyperdrive`):

```jsonc
	"r2_buckets": [
		{
			"binding": "ASSETS",
			// bucket_name is created in Plan 1D via `wrangler r2 bucket create`.
			"bucket_name": "cue-assets"
		}
	]
```

- [ ] **Step 3: Typecheck the worker entry**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "worker\.ts|asset-store"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/worker.ts apps/server/wrangler.jsonc
git commit -m "feat(server): bind R2 ASSETS bucket and set it per request"
```

---

### Task 3: Profiles routes use `asset-store`

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`

Context: replace the direct `@vercel/blob` `put`/`get` usage in the banner upload (~582-627), avatar upload (~670-719), `/me/avatar` serve (~725-757), `/banner/:handle` serve (~762-797), and `/avatar/:handle` serve (~803-863). Keys (`banners/<uid>/…`, `avatars/<uid>/…`) and route shapes are unchanged.

- [ ] **Step 1: Update imports.** Remove `import { get, put } from "@vercel/blob";` (line 18). Add:

```ts
import { getImageAsset, putImageAsset } from "../lib/asset-store";
```

- [ ] **Step 2: Banner upload.** Replace the `put(...)`+`try/catch` block (~583-610) and the persist that follows so it uses `putImageAsset`:

```ts
		const upload = await putImageAsset(key, file);
		if ("error" in upload) {
			console.error("[profiles/me/banner] upload failed", upload);
			return status(502, { error: upload.error, code: upload.code, hint: upload.hint });
		}

		const mergedPrefs = mergeBannerAnimationPref(
			(profileRow.preferences as Record<string, unknown>) ?? {},
			wantsAnimated,
		);
		const [updated] = await db
			.update(profile)
			.set({ bannerUrl: upload.value, preferences: mergedPrefs })
			.where(eq(profile.userId, user.id))
			.returning({ bannerUrl: profile.bannerUrl });
		if (!updated?.bannerUrl) {
			console.error("[profiles/me/banner] profile row not updated", user.id);
			return status(500, { error: "Failed to save banner to profile" });
		}
		return { url: updated.bannerUrl };
```

(Remove the now-unused `blob` variable and the `BLOB_READ_WRITE_TOKEN`-unset guard at the top of the handler is optional — `putImageAsset` reports `BLOB_UNCONFIGURED` via the fallback. Keep the early guard if you prefer; it is harmless.)

- [ ] **Step 3: Avatar upload.** Same transformation for the `/me/avatar` POST (~670-707): replace the `put(...)`+try/catch with:

```ts
		const upload = await putImageAsset(key, file);
		if ("error" in upload) {
			console.error("[profiles/me/avatar] upload failed", upload);
			return status(502, { error: upload.error, code: upload.code, hint: upload.hint });
		}

		const [updated] = await db
			.update(user)
			.set({ image: upload.value })
			.where(eq(user.id, authUser.id))
			.returning({ image: user.image });
		if (!updated?.image) {
			console.error("[profiles/me/avatar] user row not updated", authUser.id);
			return status(500, { error: "Failed to save portrait" });
		}
```

(Leave the `mergedPrefs` avatar-animation update and `return { url: updated.image }` below unchanged.)

- [ ] **Step 4: `/me/avatar` serve.** Replace the `get(row.image, …)` block (~739-756) with:

```ts
		const asset = await getImageAsset(row.image);
		if (!asset) return status(404, "Avatar not found");
		return new Response(asset.body, {
			headers: {
				"Content-Type": asset.contentType,
				"Cache-Control": "private, no-cache",
			},
		});
```

(The `BLOB_READ_WRITE_TOKEN`-unset guard above it may be removed; `getImageAsset` returns null when it cannot resolve.)

- [ ] **Step 5: `/banner/:handle` serve.** Replace the `get(row.bannerUrl, …)` block (~777-794) with:

```ts
			const asset = await getImageAsset(row.bannerUrl);
			if (!asset) return status(404, "Banner not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=3600, s-maxage=86400",
				},
			});
```

- [ ] **Step 6: `/avatar/:handle` serve.** Replace the whole branch from `const looksLikeVercelBlob = …` through the trailing `return status(404, "Avatar not found")` (~816-860) with:

```ts
			const asset = await getImageAsset(imageUrl);
			if (!asset) return status(404, "Avatar not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=3600, s-maxage=86400",
				},
			});
```

(`getImageAsset` already handles the R2-key, Vercel-blob, and external-URL cases that this branch handled inline.)

- [ ] **Step 7: Verify no direct blob usage remains + typecheck**

Run: `grep -nE "@vercel/blob|\bput\(|\bget\(" apps/server/src/routes/profiles.ts`
Expected: no `@vercel/blob` import; no bare `put(`/`get(` blob calls (drizzle `.get`/route `.get(` are fine — confirm the matches are Elysia `.get(`/map `.get(`, not blob).
Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep "profiles.ts"`
Expected: no output.

- [ ] **Step 8: Run profile route tests + commit**

Run: `bun test apps/server/src/routes/profiles.test.ts` (if present) — no new failures.
```bash
git add apps/server/src/routes/profiles.ts
git commit -m "refactor(server): serve/store profile images via asset-store (R2)"
```

---

### Task 4: List cover route uses `asset-store`

**Files:**
- Modify: `apps/server/src/routes/lists.ts`

- [ ] **Step 1: Update imports.** Remove `import { get } from "@vercel/blob";` (line 13) and `import { vercelBlobImagePut } from "../lib/vercel-blob-image-put";` (line 69). Add:

```ts
import { getImageAsset, putImageAsset } from "../lib/asset-store";
```

- [ ] **Step 2: Cover upload.** At the cover upload (~678), replace:

```ts
			const uploaded = await vercelBlobImagePut(key, file);
```
and the subsequent `uploaded.url` usage. Use:

```ts
			const uploaded = await putImageAsset(key, file);
			if ("error" in uploaded) {
				return status(502, { error: uploaded.error, code: uploaded.code, hint: uploaded.hint });
			}
```
then store `uploaded.value` wherever `uploaded.url` was used (e.g. `coverImageUrl: uploaded.value` around line 694).

- [ ] **Step 3: Cover serve.** Replace the cover serving block — both the non-blob `fetch()` branch (~374-390) and the Vercel `get()` branch (~392-414) — with a single:

```ts
			const asset = await getImageAsset(coverImageUrl);
			if (!asset) return status(404, "Cover not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": row?.isPublic
						? "public, max-age=3600, s-maxage=86400"
						: "private, no-cache",
				},
			});
```

- [ ] **Step 4: Verify + typecheck**

Run: `grep -nE "@vercel/blob|vercelBlobImagePut" apps/server/src/routes/lists.ts`
Expected: no output.
Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep "lists.ts"`
Expected: no output.

- [ ] **Step 5: Run list tests + commit**

Run: `bun test apps/server/src/routes/lists.test.ts` — no new failures (note: `lists.test.ts` mocks `@vercel/blob`; if it now references the removed import it may need its mock updated to `../lib/asset-store` — if so, update the mock to stub `putImageAsset`/`getImageAsset` and keep the test's intent).
```bash
git add apps/server/src/routes/lists.ts apps/server/src/routes/lists.test.ts
git commit -m "refactor(server): serve/store list covers via asset-store (R2)"
```

---

### Task 5: Migration route (Vercel Blob → R2)

**Files:**
- Create: `apps/server/src/routes/admin-assets.ts`
- Modify: `apps/server/src/server/app.ts`

Context: runs on the Worker (has both DB and R2 bindings). Internal-secret gated. Processes a batch per call so it can be invoked repeatedly until `remaining` is 0. Executed in Plan 1D after deploy.

- [ ] **Step 1: Create `apps/server/src/routes/admin-assets.ts`:**

```ts
import { db, list, profile, user } from "@still/db";
import { env } from "@still/env/server";
import { constantTimeEqual } from "@still/realtime";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { getImageAsset } from "../lib/asset-store";
// NOTE: the migration needs the R2 bucket; it is set per request by worker.ts.
import { putRawToR2 } from "../lib/asset-store-migrate";

const VERCEL_HOST = "blob.vercel-storage.com";

function authed(authHeader: string | null): boolean {
	if (!env.REALTIME_INTERNAL_SECRET) return false;
	if (!authHeader?.startsWith("Bearer ")) return false;
	return constantTimeEqual(authHeader.slice(7), env.REALTIME_INTERNAL_SECRET);
}

/** Strip the scheme+host from a Vercel Blob URL to recover the R2 object key. */
export function keyFromVercelUrl(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\/+/, "");
	} catch {
		return url;
	}
}

export const adminAssetsRoute = new Elysia({ prefix: "/api/admin/assets" })
	.post(
		"/migrate-images",
		async ({ request, query, status }) => {
			if (!authed(request.headers.get("Authorization"))) {
				return status(401, "Unauthorized");
			}
			const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);

			// Collect a batch of (table,id,column,value) needing migration.
			const banners = await db
				.select({ userId: profile.userId, url: profile.bannerUrl })
				.from(profile)
				.where(and(isNotNull(profile.bannerUrl), like(profile.bannerUrl, `%${VERCEL_HOST}%`)))
				.limit(limit);
			const avatars = await db
				.select({ id: user.id, url: user.image })
				.from(user)
				.where(and(isNotNull(user.image), like(user.image, `%${VERCEL_HOST}%`)))
				.limit(limit);
			const covers = await db
				.select({ id: list.id, url: list.coverImageUrl })
				.from(list)
				.where(and(isNotNull(list.coverImageUrl), like(list.coverImageUrl, `%${VERCEL_HOST}%`)))
				.limit(limit);

			let migrated = 0;

			for (const r of banners) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db.update(profile).set({ bannerUrl: key }).where(eq(profile.userId, r.userId));
					migrated++;
				}
			}
			for (const r of avatars) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db.update(user).set({ image: key }).where(eq(user.id, r.id));
					migrated++;
				}
			}
			for (const r of covers) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db.update(list).set({ coverImageUrl: key }).where(eq(list.id, r.id));
					migrated++;
				}
			}

			const remaining = banners.length + avatars.length + covers.length - migrated;
			return { migrated, remaining };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	);

/** Read the existing object (via getImageAsset, which reads the Vercel URL) and write it to R2 under `key`. */
async function copyToR2(sourceUrl: string, key: string): Promise<boolean> {
	const asset = await getImageAsset(sourceUrl);
	if (!asset) {
		console.error("[migrate] could not read source", sourceUrl);
		return false;
	}
	const buf = await new Response(asset.body).arrayBuffer();
	return putRawToR2(key, buf, asset.contentType);
}
```

- [ ] **Step 2: Add `putRawToR2` to the asset-store.** Append to `apps/server/src/lib/asset-store.ts`:

```ts
/** Migration helper: write raw bytes to the bound R2 bucket. False when no bucket. */
export async function putRawToR2(
	key: string,
	bytes: ArrayBuffer,
	contentType: string,
): Promise<boolean> {
	if (!_bucket) return false;
	await _bucket.put(key, bytes, { httpMetadata: { contentType } });
	return true;
}
```

Then change the migration route import to: `import { getImageAsset, putRawToR2 } from "../lib/asset-store";` and delete the `asset-store-migrate` import line (it does not exist — `putRawToR2` lives in `asset-store.ts`).

- [ ] **Step 3: Mount the route.** In `apps/server/src/server/app.ts`, add the import and `.use(adminAssetsRoute)` in the chain (near the other route mounts, e.g. after `.use(staffRoute)`):

```ts
import { adminAssetsRoute } from "../routes/admin-assets";
```
```ts
	.use(adminAssetsRoute)
```

- [ ] **Step 4: Typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | grep -E "admin-assets|asset-store|server/app.ts"`
Expected: no output. (Confirm `list`, `profile`, `user` are exported from `@still/db` — they are re-exported via the schema barrel.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/admin-assets.ts apps/server/src/lib/asset-store.ts apps/server/src/server/app.ts
git commit -m "feat(server): add internal-gated Vercel Blob → R2 image migration route"
```

---

### Task 6: Verification — bundle + suite + typecheck

**Files:** none (verification only).

- [ ] **Step 1: Build the Workers bundle (must still succeed).**

Run: `cd apps/server && bun run cf:dry-run; cd ../..`
Expected: builds clean (exit 0). The R2 binding now appears in the bindings list. Remove the `.wrangler-dryrun/` output afterward (`rm -rf apps/server/.wrangler-dryrun`).

- [ ] **Step 2: asset-store + route tests**

Run: `bun test apps/server/src/lib/asset-store.test.ts apps/server/src/routes`
Expected: PASS for asset-store; route tests show no new failures vs. baseline.

- [ ] **Step 3: Full server suite — no new failures**

Run: `bun test apps/server/src`
Expected: same baseline pass/fail set as before this plan; no new failures.

- [ ] **Step 4: Server typecheck**

Run: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit`
Expected: no new errors vs. baseline.

---

## Self-Review

- **Spec coverage:** Implements spec §4 (Blob→R2) for **images**, preserving `/api/profiles/**` and `/api/lists/**` shapes (no web change) and migrating keys 1:1. Review **audio** is explicitly deferred to **1C-audio** (it is served by direct public URL, which R2 cannot replicate without a public bucket/custom domain or a new proxy route + client change — a real decision, not a mechanical swap).
- **Placeholder scan:** `wrangler.jsonc` `bucket_name: "cue-assets"` is created in 1D (labeled). The Task 5 Step 1 draft references a non-existent `asset-store-migrate` import that Step 2 explicitly corrects to `putRawToR2` from `asset-store` — follow Step 2.
- **Type consistency:** `setAssetsBucket`, `AssetsBucket`, `getImageAsset`, `putImageAsset`, `isR2Key`, `putRawToR2` are defined in Task 1/Task 5 Step 2 and consumed consistently in worker.ts and the routes. The DB column writes (`bannerUrl`, `user.image`, `coverImageUrl`) now hold either an R2 key or a URL — both handled by `getImageAsset`.
- **Risk:** `lists.test.ts`/`profiles.test.ts` may mock `@vercel/blob`; if they reference the removed imports, Task 4 Step 5 / Task 3 Step 8 update the mocks to target `../lib/asset-store`. The migration route's batch `remaining` is approximate (counts this batch only) — callers loop until a batch returns `migrated: 0`.

## Next plans

- **1C-audio** (decision required): either (a) a public R2 bucket on a custom domain (`assets.sense.fans`) storing public URLs, or (b) a Worker-proxied `/api/reviews/:id/audio` streaming route + client change. Removes the last `@vercel/blob` usage.
- **1D — Cutover:** `wrangler hyperdrive create`, `wrangler r2 bucket create cue-assets`, secrets, bind `api.sense.fans`, deploy, run `POST /api/admin/assets/migrate-images` in a loop until `remaining: 0`, flip web/realtime origins, retire the Vercel server.
