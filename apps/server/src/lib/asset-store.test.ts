import { afterEach, describe, expect, mock, test } from "bun:test";

// Hermetic: stub env so importing ./asset-store (and its transitive
// vercel-blob-image-put) does not trigger env-schema validation at load.
mock.module("@still/env/server", () => ({
	env: {
		BLOB_READ_WRITE_TOKEN: undefined,
		BLOB_STORE_ACCESS: "public",
		NODE_ENV: "test",
		R2_ACCOUNT_ID: undefined,
		R2_ACCESS_KEY_ID: undefined,
		R2_SECRET_ACCESS_KEY: undefined,
		R2_ASSETS_BUCKET: undefined,
	},
}));

const {
	getImageAsset,
	isAllowedExternalAvatarFetchUrl,
	isR2Key,
	isSensePersistedImageRef,
	isSenseR2ImageKey,
	setAssetsBucket,
} = await import("./asset-store");

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

describe("isSenseR2ImageKey / isSensePersistedImageRef", () => {
	test("accepts Sense upload prefixes only", () => {
		expect(isSenseR2ImageKey("banners/u1/1-a.png")).toBe(true);
		expect(isSenseR2ImageKey("avatars/u1/1-a.png")).toBe(true);
		expect(isSenseR2ImageKey("list-covers/list1/1-a.png")).toBe(true);
		expect(isSenseR2ImageKey("secrets/other.png")).toBe(false);
		expect(isSenseR2ImageKey("../avatars/u1/x.png")).toBe(false);
		expect(isSenseR2ImageKey("avatars/../banners/x.png")).toBe(false);
	});

	test("persisted refs include Vercel Blob https hosts", () => {
		expect(
			isSensePersistedImageRef(
				"https://abc.public.blob.vercel-storage.com/banners/x.png",
			),
		).toBe(true);
		expect(isSensePersistedImageRef("http://evil.example/x.png")).toBe(false);
		expect(
			isSensePersistedImageRef("https://169.254.169.254/latest/meta-data"),
		).toBe(false);
	});
});

describe("isAllowedExternalAvatarFetchUrl", () => {
	test("allows known OAuth avatar CDNs over https only", () => {
		expect(
			isAllowedExternalAvatarFetchUrl(
				"https://lh3.googleusercontent.com/a/photo",
			),
		).toBe(true);
		expect(
			isAllowedExternalAvatarFetchUrl(
				"https://cdn.discordapp.com/avatars/1/a.png",
			),
		).toBe(true);
		expect(
			isAllowedExternalAvatarFetchUrl("http://lh3.googleusercontent.com/a"),
		).toBe(false);
		expect(isAllowedExternalAvatarFetchUrl("https://evil.example/a.png")).toBe(
			false,
		);
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

	test("refuses non-Sense R2 keys even when a bucket is bound", async () => {
		let gotKey: string | null = null;
		setAssetsBucket({
			put: async () => undefined,
			get: async (key: string) => {
				gotKey = key;
				return {
					body: new ReadableStream(),
					httpMetadata: { contentType: "image/png" },
				};
			},
		});
		expect(await getImageAsset("other-tenant/secret.png")).toBeNull();
		expect(gotKey).toBeNull();
	});

	test("refuses arbitrary http(s) SSRF targets", async () => {
		const originalFetch = globalThis.fetch;
		let fetched = false;
		globalThis.fetch = (async () => {
			fetched = true;
			return new Response("ok");
		}) as typeof fetch;
		try {
			expect(await getImageAsset("http://169.254.169.254/")).toBeNull();
			expect(await getImageAsset("https://evil.example/x.png")).toBeNull();
			expect(fetched).toBe(false);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
