import { afterEach, describe, expect, test } from "bun:test";

import { getImageAsset, isR2Key, setAssetsBucket } from "./asset-store";

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
