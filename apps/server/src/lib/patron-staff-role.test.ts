import { describe, expect, it } from "bun:test";

import {
	parseStaffRoleFromUserRole,
	staffRoleForUserId,
} from "./patron-staff-role";

describe("staffRoleForUserId", () => {
	it("returns staff roles from the batch map", () => {
		const roles = new Map([
			["u1", "owner" as const],
			["u2", "user" as const],
		]);
		expect(staffRoleForUserId("u1", roles)).toBe("owner");
		expect(staffRoleForUserId("u2", roles)).toBeNull();
	});

	it("defaults missing users to non-staff", () => {
		expect(staffRoleForUserId("ghost", new Map())).toBeNull();
	});
});

describe("parseStaffRoleFromUserRole", () => {
	it("accepts staff roles only", () => {
		expect(parseStaffRoleFromUserRole("moderator")).toBe("moderator");
		expect(parseStaffRoleFromUserRole("user")).toBeNull();
		expect(parseStaffRoleFromUserRole(null)).toBeNull();
	});
});
