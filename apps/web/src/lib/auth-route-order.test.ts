import { describe, expect, test } from "bun:test";
import {
	authRouteIndex,
	authRouteSlideDirection,
	resolveAuthRoutePath,
} from "./auth-route-order";

describe("auth-route-order", () => {
	test("resolveAuthRoutePath maps known routes and falls back to sign-in", () => {
		expect(resolveAuthRoutePath("/sign-up")).toBe("/sign-up");
		expect(resolveAuthRoutePath("/forgot-password")).toBe("/forgot-password");
		expect(resolveAuthRoutePath("/unknown")).toBe("/sign-in");
	});

	test("authRouteIndex follows AUTH_ROUTE_ORDER", () => {
		expect(authRouteIndex("/sign-in")).toBe(0);
		expect(authRouteIndex("/sign-up")).toBe(1);
		expect(authRouteIndex("/forgot-password")).toBe(2);
		expect(authRouteIndex("/reset-password")).toBe(3);
	});

	test("authRouteSlideDirection is forward when index increases", () => {
		expect(authRouteSlideDirection("/sign-in", "/sign-up")).toBe("forward");
		expect(authRouteSlideDirection("/sign-up", "/forgot-password")).toBe(
			"forward",
		);
		expect(authRouteSlideDirection("/sign-in", "/reset-password")).toBe(
			"forward",
		);
	});

	test("authRouteSlideDirection is back when index decreases", () => {
		expect(authRouteSlideDirection("/sign-up", "/sign-in")).toBe("back");
		expect(authRouteSlideDirection("/forgot-password", "/sign-in")).toBe(
			"back",
		);
		expect(authRouteSlideDirection("/reset-password", "/sign-up")).toBe("back");
	});
});
