import { describe, expect, test } from "bun:test";

import {
	formatStreamingPriceAmount,
	mapShowToOffersByCountry,
	mapShowToServicePrices,
	normalizeStreamingServiceKey,
	pickLowestHdPrice,
	streamingAvailabilityAuthModeForTests,
} from "./streaming-availability-prices";

describe("formatStreamingPriceAmount", () => {
	test("uses currency symbols instead of ISO codes", () => {
		expect(formatStreamingPriceAmount(24.99, "AUD")).toBe("A$24.99");
		expect(formatStreamingPriceAmount(9.99, "USD")).toBe("$9.99");
		expect(formatStreamingPriceAmount(3.99, "EUR")).toMatch(/€/);
	});
});

describe("normalizeStreamingServiceKey", () => {
	test("collapses punctuation and case", () => {
		expect(normalizeStreamingServiceKey("Apple TV")).toBe("apple");
		expect(normalizeStreamingServiceKey("Prime Video")).toBe("prime");
	});

	test("aliases common TMDb / storefront labels", () => {
		expect(normalizeStreamingServiceKey("Apple iTunes")).toBe("apple");
		expect(normalizeStreamingServiceKey("Amazon Prime Video")).toBe("prime");
		expect(normalizeStreamingServiceKey("Google Play Movies")).toBe("google");
		expect(normalizeStreamingServiceKey("HBO Max")).toBe("max");
	});
});

describe("pickLowestHdPrice", () => {
	test("prefers lowest HD over cheaper SD", () => {
		const picked = pickLowestHdPrice([
			{
				amount: 2.99,
				currency: "USD",
				formatted: "$2.99",
				quality: "sd",
			},
			{
				amount: 3.99,
				currency: "USD",
				formatted: "$3.99",
				quality: "hd",
			},
			{
				amount: 5.99,
				currency: "USD",
				formatted: "$5.99",
				quality: "hd",
			},
			{
				amount: 9.99,
				currency: "USD",
				formatted: "$9.99",
				quality: "uhd",
			},
		]);
		expect(picked?.formatted).toBe("$3.99");
		expect(picked?.quality).toBe("hd");
	});

	test("falls back to UHD/QHD when no HD", () => {
		const picked = pickLowestHdPrice([
			{
				amount: 1.99,
				currency: "EUR",
				formatted: "€1.99",
				quality: "sd",
			},
			{
				amount: 7.99,
				currency: "EUR",
				formatted: "€7.99",
				quality: "uhd",
			},
		]);
		expect(picked?.formatted).toBe("€7.99");
	});

	test("uses cheapest SD when that is all that exists", () => {
		const picked = pickLowestHdPrice([
			{
				amount: 4.5,
				currency: "GBP",
				formatted: "£4.50",
				quality: "sd",
			},
			{
				amount: 3.5,
				currency: "GBP",
				formatted: "£3.50",
				quality: "sd",
			},
		]);
		expect(picked?.formatted).toBe("£3.50");
	});
});

describe("mapShowToServicePrices", () => {
	test("aggregates rent/buy per service for the region", () => {
		const offers = mapShowToServicePrices(
			{
				streamingOptions: {
					us: [
						{
							service: { id: "apple", name: "Apple TV" },
							type: "subscription",
						},
						{
							service: { id: "apple", name: "Apple TV" },
							type: "rent",
							quality: "hd",
							price: {
								amount: "3.99",
								currency: "USD",
								formatted: "$3.99",
							},
						},
						{
							service: { id: "apple", name: "Apple TV" },
							type: "buy",
							quality: "uhd",
							price: {
								amount: "14.99",
								currency: "USD",
								formatted: "$14.99",
							},
						},
						{
							service: { id: "prime", name: "Prime Video" },
							type: "rent",
							quality: "sd",
							price: {
								amount: "2.99",
								currency: "USD",
								formatted: "$2.99",
							},
						},
					],
					gb: [
						{
							service: { id: "apple", name: "Apple TV" },
							type: "rent",
							quality: "hd",
							price: {
								amount: "3.49",
								currency: "GBP",
								formatted: "£3.49",
							},
						},
					],
				},
			},
			"US",
		);

		expect(offers).toHaveLength(2);
		const apple = offers.find((o) => o.serviceId === "apple");
		expect(apple?.rent?.formatted).toBe("$3.99");
		expect(apple?.buy?.formatted).toBe("$14.99");
		expect(apple?.nameKey).toBe("apple");
		const prime = offers.find((o) => o.serviceId === "prime");
		expect(prime?.rent?.formatted).toBe("$2.99");
		expect(prime?.buy).toBeNull();
	});

	test("ignores countries outside the requested region", () => {
		const offers = mapShowToServicePrices(
			{
				streamingOptions: {
					gb: [
						{
							service: { id: "apple", name: "Apple TV" },
							type: "rent",
							quality: "hd",
							price: {
								amount: "3.49",
								currency: "GBP",
								formatted: "£3.49",
							},
						},
					],
				},
			},
			"US",
		);
		expect(offers).toEqual([]);
	});
});

describe("mapShowToOffersByCountry", () => {
	test("groups priced offers under each uppercase country code", () => {
		const byCountry = mapShowToOffersByCountry({
			streamingOptions: {
				us: [
					{
						service: { id: "prime", name: "Prime Video" },
						type: "rent",
						quality: "hd",
						price: {
							amount: "3.99",
							currency: "USD",
							formatted: "$3.99",
						},
					},
				],
				gb: [
					{
						service: { id: "apple", name: "Apple TV" },
						type: "buy",
						quality: "hd",
						price: {
							amount: "9.99",
							currency: "GBP",
							formatted: "£9.99",
						},
					},
				],
			},
		});
		expect(Object.keys(byCountry).sort()).toEqual(["GB", "US"]);
		expect(byCountry.US?.[0]?.rent?.formatted).toBe("$3.99");
		expect(byCountry.GB?.[0]?.buy?.formatted).toBe("£9.99");
	});
});

describe("streamingAvailabilityAuthModeForTests", () => {
	test("detects RapidAPI host", () => {
		expect(
			streamingAvailabilityAuthModeForTests(
				"https://streaming-availability.p.rapidapi.com",
			),
		).toBe("rapidapi");
		expect(
			streamingAvailabilityAuthModeForTests(
				"https://api.movieofthenight.com/v4",
			),
		).toBe("direct");
	});
});
