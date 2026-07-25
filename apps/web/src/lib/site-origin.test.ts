import { describe, expect, test } from "bun:test";

describe("getSiteOrigin", () => {
	test("prefers request host over a misconfigured NEXT_PUBLIC_SERVER_URL", async () => {
		process.env.NEXT_PUBLIC_SERVER_URL = "https://cue-server-lac.vercel.app";
		const { getSiteOrigin } = await import("./site-origin");

		const origin = getSiteOrigin({
			get(name) {
				if (name === "x-forwarded-host") return "cinema.sense.fans";
				if (name === "x-forwarded-proto") return "https";
				return null;
			},
		});

		expect(origin).toBe("https://cinema.sense.fans");
	});
});
