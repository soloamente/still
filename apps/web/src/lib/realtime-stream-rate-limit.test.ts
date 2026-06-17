import { describe, expect, test } from "bun:test";

import { hitRealtimeStreamRateLimit } from "@/lib/realtime-stream-rate-limit";

describe("realtime-stream-rate-limit", () => {
	test("allows up to 10 connects per minute per user", () => {
		const userId = `usr_rate_${Date.now()}`;
		for (let i = 0; i < 10; i += 1) {
			expect(hitRealtimeStreamRateLimit(userId)).toBe(true);
		}
		expect(hitRealtimeStreamRateLimit(userId)).toBe(false);
	});
});
