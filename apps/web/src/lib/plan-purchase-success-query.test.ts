import { describe, expect, test } from "bun:test";

import {
	parsePlanPurchaseSuccessQuery,
	stripPlanPurchaseSuccessParams,
} from "./plan-purchase-success-query";

describe("parsePlanPurchaseSuccessQuery", () => {
	test("detects checkout success params", () => {
		const q = parsePlanPurchaseSuccessQuery(
			"?checkout=success&checkout_id=abc",
		);
		expect(q.isSuccess).toBe(true);
		expect(q.checkoutId).toBe("abc");
	});

	test("returns false when checkout flag missing", () => {
		expect(parsePlanPurchaseSuccessQuery("").isSuccess).toBe(false);
	});
});

describe("stripPlanPurchaseSuccessParams", () => {
	test("removes checkout params", () => {
		expect(
			stripPlanPurchaseSuccessParams(
				"/home",
				"?checkout=success&checkout_id=abc&browse=movies",
			),
		).toBe("/home?browse=movies");
	});
});
