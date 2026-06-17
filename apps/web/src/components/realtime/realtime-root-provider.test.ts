import { describe, expect, test } from "bun:test";

import { buildRealtimeStreamUrl } from "@/components/realtime/realtime-root-provider";

describe("realtime-root-provider helpers", () => {
	test("buildRealtimeStreamUrl encodes room list", () => {
		expect(buildRealtimeStreamUrl(["user:usr_1:inbox"])).toBe(
			"/api/realtime/stream?rooms=user%3Ausr_1%3Ainbox",
		);
		expect(buildRealtimeStreamUrl(["review:rev_1", "user:u:inbox"])).toBe(
			"/api/realtime/stream?rooms=review%3Arev_1%2Cuser%3Au%3Ainbox",
		);
	});
});
