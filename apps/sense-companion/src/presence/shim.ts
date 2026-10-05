import type {
	CompanionActivityMessage,
	CompanionActivityPayload,
	SenseMedia,
} from "./activity-log.ts";
import { withCompanionEpisodeTitle } from "./companion-episode-title.ts";
import { resolveEnglishStrings } from "./strings.ts";

type PresenceListener = () => Promise<void> | void;

type ActivityInput = {
	type?: number | null;
	name?: string | null;
	details?: string | { textContent?: string | null } | null;
	state?: string | { textContent?: string | null } | null;
	largeImageKey?: string | null;
	largeImageText?: string | null;
	smallImageKey?: string | null;
	smallImageText?: string | null;
	startTimestamp?: number | Date | null;
	endTimestamp?: number | Date | null;
	senseMedia?: unknown;
};

type PresenceRuntime = {
	service: string;
	settings: Record<string, string | number | boolean>;
	emit: (message: CompanionActivityMessage) => void;
	listeners: Map<Presence, PresenceListener[]>;
	senseMedia: SenseMedia | null;
};

function createRuntime(
	next: Omit<PresenceRuntime, "listeners" | "senseMedia">,
): PresenceRuntime {
	return { ...next, listeners: new Map(), senseMedia: null };
}

let runtime: PresenceRuntime = createRuntime({
	service: "Sense",
	settings: {},
	emit: () => {},
});

/** Called once per tab before the vendored site script is imported. */
export function configurePresenceRuntime(
	next: Omit<PresenceRuntime, "listeners" | "senseMedia">,
): void {
	runtime = createRuntime(next);
}

/**
 * Saved setup choices replace the map in place. The site script already holds
 * this runtime, so the next playback tick sees the new values.
 */
export function replacePresenceSettings(
	settings: Record<string, string | number | boolean>,
): void {
	runtime.settings = settings;
}

function readText(
	value: string | { textContent?: string | null } | null | undefined,
): string | null {
	if (typeof value === "string") return value;
	if (value && typeof value.textContent === "string") return value.textContent;
	return null;
}

function readTimestamp(value: number | Date | null | undefined): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (value instanceof Date) return Math.floor(value.getTime() / 1000);
	return null;
}

function readOptionalNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function reportSenseMedia(media: SenseMedia | null): void {
	runtime.senseMedia = media ? readSenseMedia(media) : null;
}

function readSenseMedia(value: unknown): SenseMedia | null {
	if (typeof value !== "object" || value === null) return null;
	const media = value as SenseMedia;
	if (
		media.provider !== "netflix" &&
		media.provider !== "disney" &&
		media.provider !== "hotstar" &&
		media.provider !== "prime" &&
		media.provider !== "apple" &&
		media.provider !== "max" &&
		media.provider !== "web"
	) {
		return null;
	}
	if (media.kind !== "movie" && media.kind !== "episode") return null;
	if (typeof media.title !== "string" || media.title.length === 0) return null;
	const episodeTitle =
		typeof media.episodeTitle === "string" && media.episodeTitle.trim()
			? media.episodeTitle.trim().slice(0, 300)
			: undefined;
	return {
		provider: media.provider,
		kind: media.kind,
		title: media.title,
		season: readOptionalNumber(media.season),
		episode: readOptionalNumber(media.episode),
		positionSec: readOptionalNumber(media.positionSec),
		durationSec: readOptionalNumber(media.durationSec),
		...(episodeTitle ? { episodeTitle } : {}),
		...(typeof media.serviceLabel === "string" && media.serviceLabel.trim()
			? { serviceLabel: media.serviceLabel.trim().slice(0, 80) }
			: {}),
	};
}

function attachEpisodeTitle(
	media: SenseMedia,
	activity: CompanionActivityPayload,
): SenseMedia {
	return { ...media, ...withCompanionEpisodeTitle(media, activity) };
}

function normalizeActivity(data: ActivityInput): CompanionActivityPayload {
	return {
		type: typeof data.type === "number" ? data.type : null,
		name: readText(data.name),
		details: readText(data.details),
		state: readText(data.state),
		largeImageKey:
			typeof data.largeImageKey === "string" ? data.largeImageKey : null,
		largeImageText: readText(data.largeImageText),
		smallImageKey:
			typeof data.smallImageKey === "string" ? data.smallImageKey : null,
		smallImageText: readText(data.smallImageText),
		startTimestamp: readTimestamp(data.startTimestamp),
		endTimestamp: readTimestamp(data.endTimestamp),
	};
}

/**
 * Stand-in for PreMiD's Presence class. Site scripts call setActivity;
 * we forward a plain payload to the service worker instead of Discord.
 */
export class Presence {
	private readonly runtime: PresenceRuntime;

	constructor(_options: { clientId: string }) {
		// Bind this instance to the runtime that was current at construction,
		// so a later tab or test cannot retarget an already-loaded site script.
		this.runtime = runtime;
		this.runtime.listeners.set(this, []);
	}

	on(event: "UpdateData", listener: PresenceListener): void {
		if (event !== "UpdateData") return;
		this.runtime.listeners.get(this)?.push(listener);
	}

	getSetting<T extends string | number | boolean>(setting: string): Promise<T> {
		if (!(setting in this.runtime.settings)) {
			return Promise.reject(
				new Error(`Unknown Sense Companion setting: ${setting}`),
			);
		}
		return Promise.resolve(this.runtime.settings[setting] as T);
	}

	getStrings<T extends Record<string, string>>(
		request: T,
	): Promise<{ [K in keyof T]: string }> {
		return resolveEnglishStrings(request);
	}

	setActivity(data?: ActivityInput): Promise<void> {
		if (!data) {
			this.clearActivity();
			return Promise.resolve();
		}
		const activity = normalizeActivity(data);
		// Site scripts call reportSenseMedia() before setActivity(), so the media
		// object is usually on the runtime, not on this payload.
		const attached = readSenseMedia(data.senseMedia) ?? this.runtime.senseMedia;
		if (attached) {
			this.runtime.senseMedia = attachEpisodeTitle(attached, activity);
		}
		this.runtime.emit({
			type: "sense-companion:activity",
			service: this.runtime.service,
			activity,
			senseMedia: this.runtime.senseMedia,
		});
		return Promise.resolve();
	}

	clearActivity(): void {
		this.runtime.senseMedia = null;
		this.runtime.emit({
			type: "sense-companion:clear",
			service: this.runtime.service,
		});
	}

	error(message: string): void {
		console.error("Sense Companion", message);
	}
}

// Site scripts call this as a global, the same way they call `Presence`.
Object.assign(globalThis, { reportSenseMedia });

/** Runs every site script's UpdateData handler. The content script calls this about once a second. */
export async function tickPresenceUpdates(): Promise<void> {
	const pending: Array<Promise<void> | void> = [];
	for (const group of runtime.listeners.values()) {
		for (const listener of group) pending.push(listener());
	}
	await Promise.all(pending);
}
