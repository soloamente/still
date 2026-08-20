import { describe, expect, test } from "bun:test";
import { parseDiscordActivityProTarget } from "./discord-activity-pro-target";

describe("parseDiscordActivityProTarget", () => {
	test("defaults to 50", () => {
		expect(parseDiscordActivityProTarget(undefined)).toBe(50);
		expect(parseDiscordActivityProTarget("")).toBe(50);
		expect(parseDiscordActivityProTarget("nope")).toBe(50);
		expect(parseDiscordActivityProTarget("0")).toBe(50);
		expect(parseDiscordActivityProTarget("-3")).toBe(50);
	});
	test("parses positive integers", () => {
		expect(parseDiscordActivityProTarget("100")).toBe(100);
		expect(parseDiscordActivityProTarget(" 75 ")).toBe(75);
	});
});
