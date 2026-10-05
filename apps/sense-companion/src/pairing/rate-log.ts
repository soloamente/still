import type { CompanionTokenStore } from "./client";
import { SENSE_COMPANION_API_ORIGIN } from "./origin";

type FetchLike = (
	input: string,
	init?: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
		targetAddressSpace?: "loopback";
	},
) => Promise<{ ok: boolean; status: number }>;

export function isCompanionRateRequest(value: unknown): value is {
	type: "sense-companion:rate-log";
	id: string;
	logId: string;
	rating: number;
} {
	if (typeof value !== "object" || value === null) return false;
	const message = value as {
		type?: unknown;
		id?: unknown;
		logId?: unknown;
		rating?: unknown;
	};
	return (
		message.type === "sense-companion:rate-log" &&
		typeof message.id === "string" &&
		typeof message.logId === "string" &&
		message.logId.length > 0 &&
		typeof message.rating === "number" &&
		Number.isFinite(message.rating)
	);
}

/** Write the score the toast just asked for. */
export async function postCompanionLogRating(input: {
	store: CompanionTokenStore;
	logId: string;
	rating: number;
	origin?: string;
	fetchImpl?: FetchLike;
}): Promise<boolean> {
	const token = await input.store.get();
	if (!token) return false;
	const fetchImpl = input.fetchImpl ?? fetch;
	try {
		const response = await fetchImpl(
			`${input.origin ?? SENSE_COMPANION_API_ORIGIN}/api/companion/log-rating`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ logId: input.logId, rating: input.rating }),
				targetAddressSpace: "loopback",
			},
		);
		if (!response.ok) {
			console.error("Sense Companion rating failed", response.status);
			return false;
		}
		return true;
	} catch (error) {
		console.error("Sense Companion rating failed", error);
		return false;
	}
}
