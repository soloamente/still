import { describe, expect, it } from "bun:test";
import { APP_NAME } from "./app-brand";
import {
	roleChangeDirection,
	roleChangeNotificationContent,
} from "./role-change-notification";

describe("roleChangeDirection", () => {
	it("returns promoted when rank increases", () => {
		expect(roleChangeDirection("user", "moderator")).toBe("promoted");
		expect(roleChangeDirection("support", "admin")).toBe("promoted");
		expect(roleChangeDirection("moderator", "owner")).toBe("promoted");
	});
	it("returns demoted when rank decreases", () => {
		expect(roleChangeDirection("admin", "support")).toBe("demoted");
		expect(roleChangeDirection("moderator", "user")).toBe("demoted");
	});
	it("returns null when rank is unchanged", () => {
		expect(roleChangeDirection("admin", "admin")).toBeNull();
		expect(roleChangeDirection("user", "user")).toBeNull();
	});
});

describe("roleChangeNotificationContent", () => {
	it("celebrates a promotion with the new role label", () => {
		const c = roleChangeNotificationContent("promoted", "moderator");
		expect(c.title).toBe("You're now a Moderator");
		expect(c.body).toBe(`You've got new staff permissions on ${APP_NAME}.`);
	});
	it("uses the right article for admin and owner", () => {
		expect(roleChangeNotificationContent("promoted", "admin").title).toBe(
			"You're now an Admin",
		);
		expect(roleChangeNotificationContent("promoted", "owner").title).toBe(
			"You're now the Owner",
		);
	});
	it("informs on a demotion to a lower staff role", () => {
		const c = roleChangeNotificationContent("demoted", "support");
		expect(c.title).toBe("Your role has changed");
		expect(c.body).toBe(
			"You're now a Support — some staff tools are no longer available.",
		);
	});
	it("informs on a demotion to a regular member", () => {
		const c = roleChangeNotificationContent("demoted", "user");
		expect(c.title).toBe("Your role has changed");
		expect(c.body).toBe("You no longer have staff access.");
	});
});
