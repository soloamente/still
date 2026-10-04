/** Calendar-day pin for Watch tonight — not the Today pick continuity keys. */
export const WATCH_TONIGHT_DAY_KEY = "still:watch-tonight:day:v1";

export type WatchTonightDayPin = {
	dayKey: string;
	tmdbId: number;
	skippedIds: number[];
};

type WatchTonightStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeRemove(storage: WatchTonightStorage): void {
	try {
		storage.removeItem(WATCH_TONIGHT_DAY_KEY);
	} catch {
		// Quota / blocked storage — the pin is best-effort.
	}
}

function parseSkippedIds(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	const ids = value.filter(
		(id): id is number =>
			typeof id === "number" && Number.isFinite(id) && id > 0,
	);
	// A field that is not an array of positive numbers collapses to [].
	return ids.length === value.length ? ids : [];
}

function parsePin(raw: string | null): WatchTonightDayPin | null {
	if (!raw) return null;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (data == null || typeof data !== "object") return null;
	const entry = data as Partial<WatchTonightDayPin>;
	if (
		typeof entry.dayKey !== "string" ||
		entry.dayKey.length === 0 ||
		typeof entry.tmdbId !== "number" ||
		!Number.isFinite(entry.tmdbId) ||
		entry.tmdbId <= 0
	) {
		return null;
	}
	return {
		dayKey: entry.dayKey,
		tmdbId: entry.tmdbId,
		skippedIds: parseSkippedIds(entry.skippedIds),
	};
}

export function readWatchTonightDayPin(
	storage: WatchTonightStorage,
	dayKey: string,
): WatchTonightDayPin | null {
	let raw: string | null = null;
	try {
		raw = storage.getItem(WATCH_TONIGHT_DAY_KEY);
	} catch {
		return null;
	}
	const pin = parsePin(raw);
	if (!pin || pin.dayKey !== dayKey) {
		if (raw != null) safeRemove(storage);
		return null;
	}
	return pin;
}

export function writeWatchTonightDayPin(
	storage: WatchTonightStorage,
	pin: WatchTonightDayPin,
): void {
	try {
		storage.setItem(WATCH_TONIGHT_DAY_KEY, JSON.stringify(pin));
	} catch {
		// Quota / blocked storage — the day's pick still shows this session.
	}
}
