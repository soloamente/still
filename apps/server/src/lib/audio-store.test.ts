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
		const result = await putAudioAsset("reviews/u1/r1.webm", file, 1000);
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
