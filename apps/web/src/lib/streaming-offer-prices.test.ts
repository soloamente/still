import { describe, expect, test } from "bun:test";

import {
	findStreamingPricesForProvider,
	normalizeStreamingServiceKey,
} from "./streaming-offer-prices";

describe("findStreamingPricesForProvider", () => {
	const offers = [
		{
			serviceId: "apple",
			serviceName: "Apple TV",
			nameKey: "apple",
			rent: {
				amount: 3.99,
				currency: "USD",
				formatted: "$3.99",
				quality: "hd",
			},
			buy: null,
		},
	];

	test("matches TMDb Apple iTunes to Apple TV offers", () => {
		expect(normalizeStreamingServiceKey("Apple iTunes")).toBe("apple");
		expect(
			findStreamingPricesForProvider(offers, "Apple iTunes")?.rent?.formatted,
		).toBe("$3.99");
	});

	test("returns null when unmatched", () => {
		expect(findStreamingPricesForProvider(offers, "Netflix")).toBeNull();
	});
});
