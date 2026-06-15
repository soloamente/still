import { describe, expect, test } from "bun:test";

import { vercelBlobAudioPut } from "./vercel-blob-audio-put";

describe("vercelBlobAudioPut", () => {
	test("rejects invalid mime before Blob upload", async () => {
		const file = new File([new Uint8Array(100)], "voice.wav", {
			type: "audio/wav",
		});
		const result = await vercelBlobAudioPut("reviews/u/r.webm", file, 5000);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.code).toBe("INVALID_MIME");
		}
	});

	test("rejects oversize file before Blob upload", async () => {
		const file = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "voice.webm", {
			type: "audio/webm",
		});
		const result = await vercelBlobAudioPut("reviews/u/r.webm", file, 5000);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.code).toBe("FILE_TOO_LARGE");
		}
	});
});
