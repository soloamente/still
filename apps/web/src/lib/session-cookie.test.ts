import { describe, expect, it } from "bun:test";
import { NextResponse } from "next/server";

import { clearSessionCookies } from "./session-cookie";

describe("clearSessionCookies", () => {
	it("expires both Better Auth session cookie names with production attributes", () => {
		const res = NextResponse.next();
		clearSessionCookies(res);
		const setCookies = res.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("better-auth.session_token=");
		expect(setCookies).toContain("__Secure-better-auth.session_token=");
		expect(/max-age=0|expires=/i.test(setCookies)).toBe(true);
		expect(setCookies.toLowerCase()).toContain("secure");
		expect(setCookies.toLowerCase()).toContain("samesite=none");
	});
});
