// Globals the vendored PreMiD site scripts expect. The real class lives in shim.ts
// and is assigned onto globalThis before those scripts load.
declare class Presence {
	constructor(options: { clientId: string });
	on(event: string, listener: () => Promise<void> | void): void;
	getSetting<T>(setting: string): Promise<T>;
	getStrings<T>(strings: T): Promise<T>;
	setActivity(data?: object): Promise<void>;
	clearActivity(): void;
	error(message: string): void;
}

interface PresenceData {
	[key: string]: unknown;
}

declare function reportSenseMedia(
	media: {
		provider: "netflix" | "disney" | "hotstar" | "prime" | "apple" | "max";
		kind: "movie" | "episode";
		title: string;
		season: number | null;
		episode: number | null;
		positionSec: number | null;
		durationSec: number | null;
	} | null,
): void;
