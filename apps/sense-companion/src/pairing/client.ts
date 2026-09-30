export type CompanionPairError = "invalid_code" | "expired" | "already_used";

export type CompanionTokenStore = {
	get(): Promise<string | null>;
	set(token: string): Promise<void>;
	clear(): Promise<void>;
};

export type CompanionPairResult =
	| { ok: true }
	| { ok: false; error: CompanionPairError | "unreachable" };

export type CompanionStatus = "paired" | "not_paired" | "unreachable";

type FetchLike = (
	input: string,
	init?: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
		credentials?: "include";
		targetAddressSpace?: "loopback";
	},
) => Promise<Response>;

/** Same hyphen-stripping the server uses, so a pasted code always matches. */
export function normalizeCompanionCode(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatCompanionCode(raw: string): string {
	const normalized = normalizeCompanionCode(raw);
	if (normalized.length <= 4) return normalized;
	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function pairErrorCopy(error: CompanionPairError): string {
	switch (error) {
		case "invalid_code":
			return "That code didn't work.";
		case "expired":
			return "That code expired. Ask Sense for a new one.";
		case "already_used":
			return "That code was already used.";
		default: {
			const neverError: never = error;
			return neverError;
		}
	}
}

function isPairError(value: string): value is CompanionPairError {
	return (
		value === "invalid_code" || value === "expired" || value === "already_used"
	);
}

/** Test double. The popup uses `chrome.storage.local` instead. */
export function memoryCompanionTokenStore(
	initial: string | null = null,
): CompanionTokenStore {
	let token = initial;
	return {
		async get() {
			return token;
		},
		async set(next) {
			token = next;
		},
		async clear() {
			token = null;
		},
	};
}

export async function pairCompanion(input: {
	origin: string;
	code: string;
	store: CompanionTokenStore;
	fetchImpl?: FetchLike;
}): Promise<CompanionPairResult> {
	const code = formatCompanionCode(input.code);
	if (normalizeCompanionCode(code).length !== 8) {
		return { ok: false, error: "invalid_code" };
	}
	const fetchImpl = input.fetchImpl ?? fetch;
	let response: Response;
	try {
		response = await fetchImpl(`${input.origin}/api/companion/token`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code }),
		});
	} catch {
		return { ok: false, error: "unreachable" };
	}

	if (!response.ok) {
		const error = await readPairError(response);
		return { ok: false, error };
	}

	const body = (await response.json()) as { token?: unknown };
	if (typeof body.token !== "string" || body.token.length === 0) {
		return { ok: false, error: "invalid_code" };
	}
	await input.store.set(body.token);
	return { ok: true };
}

export async function readCompanionStatus(input: {
	origin: string;
	store: CompanionTokenStore;
	fetchImpl?: FetchLike;
}): Promise<CompanionStatus> {
	const token = await input.store.get();
	if (!token) return "not_paired";
	const fetchImpl = input.fetchImpl ?? fetch;
	let response: Response;
	try {
		response = await fetchImpl(`${input.origin}/api/companion/session`, {
			headers: { authorization: `Bearer ${token}` },
		});
	} catch {
		return "unreachable";
	}
	if (response.status === 401) {
		await input.store.clear();
		return "not_paired";
	}
	if (!response.ok) return "unreachable";
	return "paired";
}

/**
 * Public Sense profile URL for Discord's View profile button.
 * Null when unpaired, unreachable, private, or missing.
 */
export async function readCompanionProfileUrl(input: {
	origin: string;
	store: CompanionTokenStore;
	fetchImpl?: FetchLike;
}): Promise<string | null> {
	const token = await input.store.get();
	if (!token) return null;
	const fetchImpl = input.fetchImpl ?? fetch;
	let response: Response;
	try {
		response = await fetchImpl(`${input.origin}/api/companion/session`, {
			headers: { authorization: `Bearer ${token}` },
		});
	} catch {
		return null;
	}
	if (!response.ok) return null;
	try {
		const body = (await response.json()) as { profileUrl?: unknown };
		return typeof body.profileUrl === "string" ? body.profileUrl : null;
	} catch {
		return null;
	}
}

async function readPairError(
	response: Response,
): Promise<CompanionPairError | "unreachable"> {
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === "string" && isPairError(body.error)) {
			return body.error;
		}
	} catch {
		// Non-JSON 401 still means the code was rejected.
	}
	if (response.status === 401) return "invalid_code";
	return "unreachable";
}

/** Origins where a Sense session cookie might live. Localhost is the usual one. */
const LINK_ORIGINS = [
	"http://localhost:3001",
	"http://127.0.0.1:3001",
] as const;

/**
 * Store a device token for the Sense account already signed in on this computer.
 * Discord does not need this. The profile row does.
 */
export async function linkCompanion(input: {
	store: CompanionTokenStore;
	fetchImpl?: FetchLike;
	origins?: readonly string[];
}): Promise<"paired" | "signed_out" | "unreachable"> {
	if (await input.store.get()) return "paired";
	const fetchImpl = input.fetchImpl ?? fetch;
	const origins = input.origins ?? LINK_ORIGINS;
	let sawSignedOut = false;
	for (const origin of origins) {
		let response: Response;
		try {
			response = await fetchImpl(`${origin}/api/me/companion/link`, {
				method: "POST",
				credentials: "include",
				headers: {
					"content-type": "application/json",
					"x-sense-companion": "link",
				},
				targetAddressSpace: "loopback",
			});
		} catch {
			continue;
		}
		if (response.status === 401) {
			sawSignedOut = true;
			continue;
		}
		if (!response.ok) continue;
		const body = (await response.json()) as { token?: unknown };
		if (typeof body.token !== "string" || body.token.length === 0) continue;
		await input.store.set(body.token);
		return "paired";
	}
	return sawSignedOut ? "signed_out" : "unreachable";
}
