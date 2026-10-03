import { popupWatchFromMessage } from "../src/popup/watch-state";
import {
	activityIsPaused,
	type CompanionActivityMessage,
	SENSE_COMPANION_WATCH_PORT,
} from "../src/presence/activity-log";
import {
	type AutologMediaClock,
	emptyAutologCountdownState,
	nextAutologCountdown,
} from "../src/presence/autolog-countdown";
import { syncAutologCountdownPill } from "../src/presence/autolog-countdown-view";
import {
	type CompanionLoggedNotice,
	readCompanionLoggedNotice,
} from "../src/presence/logged-notice";
import { showLoggedToast } from "../src/presence/logged-toast-view";
import {
	mergeSettingOverrides,
	parseStoredSettings,
	settingDefaults,
} from "../src/presence/settings";
import {
	configurePresenceRuntime,
	Presence,
	replacePresenceSettings,
	tickPresenceUpdates,
} from "../src/presence/shim";
import { COMPANION_SETTINGS_KEY } from "../src/presence/site-settings";
import { companionSite } from "../src/presence/sites";
import {
	emptyWatchToastState,
	nextWatchToast,
	playingNoticeStillCurrent,
	type WatchToastState,
	watchToastCopy,
} from "../src/presence/watch-toast";
import { showWatchToast } from "../src/presence/watch-toast-view";
import appleMetadata from "../vendor/premid-activities/websites/A/Apple TV+/metadata.json";
import disneyMetadata from "../vendor/premid-activities/websites/D/Disney+/metadata.json";
import maxMetadata from "../vendor/premid-activities/websites/H/HBO Max/metadata.json";
import netflixMetadata from "../vendor/premid-activities/websites/N/Netflix/metadata.json";
import primeMetadata from "../vendor/premid-activities/websites/P/Prime Video/metadata.json";

const netflixPattern = new RegExp(netflixMetadata.regExp, "i");
const disneyPattern = new RegExp(disneyMetadata.regExp, "i");
const primePattern = new RegExp(primeMetadata.regExp, "i");
const applePattern = new RegExp(appleMetadata.regExp, "i");
const maxPattern = new RegExp(maxMetadata.regExp, "i");
const playMaxPattern = /^https?:\/\/play\.max\.com\//i;

type StreamingSite = "netflix" | "disney" | "prime" | "apple" | "max";

function streamingSite(href: string): StreamingSite | null {
	if (netflixPattern.test(href)) return "netflix";
	if (disneyPattern.test(href)) return "disney";
	if (primePattern.test(href)) return "prime";
	if (applePattern.test(href)) return "apple";
	// Upstream still names the player play.hbomax.com. play.max.com is the same app.
	if (maxPattern.test(href) || playMaxPattern.test(href)) return "max";
	return null;
}

function siteCatalog(site: StreamingSite): {
	service: string;
	settings: ReturnType<typeof companionSite>["settings"];
} {
	return companionSite(site);
}

const UPDATE_INTERVAL_MS = 1000;
/** Silent pairing checks on this page. A third tick must not probe again. */
const AUTOLOG_PROBE_ATTEMPT_LIMIT = 2;

/** Title, kind, and episode identity from a diary notice. */
type PendingLoggedNotice = Pick<
	CompanionLoggedNotice,
	"title" | "kind" | "season" | "episode"
>;

let watchPort: Browser.runtime.Port | null = null;
/** Avoid double toasts when the API and the native host both report the same row. */
let lastLoggedToastId: string | null = null;
/** Countdown for this page. The logged-notice listener and the playback tick share it. */
let autologState = emptyAutologCountdownState();
let autologPaired: boolean | null = null;
let autologLogged = false;
/** Title last seen, including before pairing has stored a countdown key. */
let autologTitleKey: string | null = null;
/**
 * A log that arrived after the player cleared. Applied on the next tick that
 * has media, and only when that media is the same film or episode.
 */
let pendingLoggedNotice: PendingLoggedNotice | null = null;
/** In-flight pairing check. Cleared after a miss so one later tick can retry. */
let autologProbe: Promise<void> | null = null;
/** Silent checks on this page. After two misses, ticks stop probing. */
let autologProbeAttempts = 0;
/** Latest tick, so a late pairing answer repaints the title playing now. */
let autologView: {
	message: CompanionActivityMessage;
	paused: boolean;
} | null = null;

/** Film or episode on this tick. Null when the player has cleared. */
function screenMedia(): {
	kind: string;
	title: string;
	season: number | null;
	episode: number | null;
} | null {
	const message = autologView?.message;
	if (message == null || message.type !== "sense-companion:activity")
		return null;
	return message.senseMedia;
}

/**
 * A tv notice matches an episode with the same title, season, and episode.
 * A movie notice matches a film with the same title. Nothing on screen does not match.
 */
function noticeMatchesMedia(
	notice: PendingLoggedNotice,
	media: {
		kind: string;
		title: string;
		season: number | null;
		episode: number | null;
	},
): boolean {
	const sameTitle =
		notice.title.trim().toLowerCase() === media.title.trim().toLowerCase();
	if (!sameTitle) return false;
	switch (notice.kind) {
		case "movie":
			return media.kind === "movie";
		case "tv":
			return (
				media.kind === "episode" &&
				media.season === notice.season &&
				media.episode === notice.episode
			);
		default: {
			const _exhaustive: never = notice.kind;
			return _exhaustive;
		}
	}
}

/** True only when this log is the film or episode currently on screen. */
function loggedNoticeMatchesScreen(notice: CompanionLoggedNotice): boolean {
	const media = screenMedia();
	if (media == null) return false;
	return noticeMatchesMedia(notice, media);
}

function handleLoggedNotice(notice: CompanionLoggedNotice): void {
	if (notice.logId === lastLoggedToastId) return;
	lastLoggedToastId = notice.logId;
	const media = screenMedia();
	if (media == null) {
		// The player already cleared. Remember the row so the next title can
		// claim it. Don't latch the flag — a later title would stay hidden.
		pendingLoggedNotice = {
			title: notice.title,
			kind: notice.kind,
			season: notice.season,
			episode: notice.episode,
		};
		syncAutologCountdownPill({ phase: "hidden", remainingSec: null });
	} else if (loggedNoticeMatchesScreen(notice)) {
		pendingLoggedNotice = null;
		autologLogged = true;
		syncAutologCountdownPill({ phase: "hidden", remainingSec: null });
	}
	showLoggedToast(notice, (rating) => requestLogRating(notice.logId, rating));
}

function ensureWatchPort(): Browser.runtime.Port {
	if (!watchPort) {
		watchPort = browser.runtime.connect({ name: SENSE_COMPANION_WATCH_PORT });
		watchPort.onMessage.addListener((value: unknown) => {
			const notice = readCompanionLoggedNotice(value);
			if (!notice) return;
			handleLoggedNotice(notice);
		});
		watchPort.onDisconnect.addListener(() => {
			watchPort = null;
		});
	}
	return watchPort;
}

function isRateResult(
	value: unknown,
	id: string,
): value is { type: "sense-companion:rate-result"; id: string; ok: boolean } {
	if (typeof value !== "object" || value === null) return false;
	const result = value as { type?: unknown; id?: unknown; ok?: unknown };
	return (
		result.type === "sense-companion:rate-result" &&
		result.id === id &&
		typeof result.ok === "boolean"
	);
}

/** Ask the background to store the score. It holds the pairing token. */
function requestLogRating(logId: string, rating: number): Promise<boolean> {
	const id = crypto.randomUUID();
	try {
		const active = ensureWatchPort();
		const result = new Promise<boolean>((resolve) => {
			const timer = window.setTimeout(() => {
				active.onMessage.removeListener(onMessage);
				resolve(false);
			}, 8000);
			const onMessage = (value: unknown) => {
				if (!isRateResult(value, id)) return;
				window.clearTimeout(timer);
				active.onMessage.removeListener(onMessage);
				resolve(value.ok);
			};
			active.onMessage.addListener(onMessage);
		});
		active.postMessage({
			type: "sense-companion:rate-log",
			id,
			logId,
			rating,
		});
		return result;
	} catch {
		watchPort = null;
		return Promise.resolve(false);
	}
}

function isWatchResult(
	value: unknown,
	id: string,
): value is { type: "sense-companion:watch-result"; id: string; ok: boolean } {
	if (typeof value !== "object" || value === null) return false;
	const result = value as { type?: unknown; id?: unknown; ok?: unknown };
	return (
		result.type === "sense-companion:watch-result" &&
		result.id === id &&
		typeof result.ok === "boolean"
	);
}

/** Keep a port open so Chrome does not cancel the profile save mid-request. */
function postWatch(message: CompanionActivityMessage): void {
	try {
		ensureWatchPort().postMessage(message);
	} catch {
		watchPort = null;
		void browser.runtime.sendMessage(message);
	}
}

/** Ask whether this title reached the helper before painting the mark. */
function confirmWatchDelivery(
	message: CompanionActivityMessage,
): Promise<boolean> {
	const id = crypto.randomUUID();
	try {
		const active = ensureWatchPort();
		const result = new Promise<boolean>((resolve) => {
			const timer = window.setTimeout(() => {
				active.onMessage.removeListener(onMessage);
				resolve(false);
			}, 4000);
			const onMessage = (value: unknown) => {
				if (!isWatchResult(value, id)) return;
				window.clearTimeout(timer);
				active.onMessage.removeListener(onMessage);
				resolve(value.ok);
			};
			active.onMessage.addListener(onMessage);
		});
		active.postMessage({ ...message, toastId: id });
		return result;
	} catch {
		watchPort = null;
		void browser.runtime.sendMessage(message);
		return Promise.resolve(false);
	}
}

/** Same identity the countdown uses, so a new episode can leave the logged flag. */
function autologMediaKey(media: AutologMediaClock): string {
	return [
		media.provider,
		media.kind,
		media.title.trim().toLowerCase(),
		media.season ?? "",
		media.episode ?? "",
	].join("\0");
}

function paintAutolog(
	message: CompanionActivityMessage,
	paused: boolean,
): void {
	autologView = { message, paused };
	const sense =
		message.type === "sense-companion:activity" ? message.senseMedia : null;
	const media: AutologMediaClock | null = sense
		? {
				provider: sense.provider,
				kind: sense.kind,
				title: sense.title,
				season: sense.season,
				episode: sense.episode,
				positionSec: sense.positionSec,
				durationSec: sense.durationSec,
			}
		: null;
	// The countdown keeps its previous key while logged or unpaired, so a new
	// title has to clear the flag before that decision or the pill stays hidden.
	if (media == null) {
		if (autologTitleKey != null) autologLogged = false;
		autologTitleKey = null;
	} else {
		const key = autologMediaKey(media);
		if (autologTitleKey != null && key !== autologTitleKey) {
			autologLogged = false;
		}
		autologTitleKey = key;
		// Apply a log that arrived on an empty screen before the countdown decision.
		if (pendingLoggedNotice != null) {
			if (noticeMatchesMedia(pendingLoggedNotice, media)) {
				autologLogged = true;
			} else {
				pendingLoggedNotice = null;
				autologLogged = false;
			}
		}
	}
	const decision = nextAutologCountdown({
		state: autologState,
		now: Date.now(),
		paired: autologPaired === true,
		paused,
		logged: autologLogged,
		media,
	});
	if (decision.state.key !== autologState.key) autologLogged = false;
	autologState = decision.state;
	syncAutologCountdownPill(decision);
}

/** A success reveals the pill. A timeout must not stick the page as unpaired. */
function repaintAutolog(ok: boolean): void {
	if (!ok) return;
	autologPaired = true;
	const latest = autologView;
	if (latest == null) return;
	paintAutolog(latest.message, latest.paused);
}

/** Drop a finished miss so one later tick can probe again. */
function releaseAutologProbe(delivery: Promise<void>): void {
	if (autologPaired !== true && autologProbe === delivery) autologProbe = null;
}

const pageFetch = globalThis.fetch.bind(globalThis);

function withPageCookies(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	return pageFetch(input, { ...init, credentials: "include" });
}

export default defineContentScript({
	matches: [
		"*://*.netflix.com/*",
		"*://netflix.com/*",
		"*://*.disneyplus.com/*",
		"*://*.hotstar.com/*",
		"*://*.primevideo.com/*",
		"*://primevideo.com/*",
		"*://*.amazon.com/*",
		"*://*.amazon.co.uk/*",
		"*://*.amazon.de/*",
		"*://*.amazon.co.jp/*",
		"*://*.amazon.ca/*",
		"*://*.amazon.com.au/*",
		"*://*.amazon.fr/*",
		"*://*.amazon.it/*",
		"*://*.amazon.es/*",
		"*://*.amazon.in/*",
		"*://*.amazon.com.br/*",
		"*://*.amazon.com.mx/*",
		"*://*.amazon.nl/*",
		"*://tv.apple.com/*",
		"*://play.hbomax.com/*",
		"*://play.max.com/*",
	],
	runAt: "document_idle",
	async main(ctx) {
		const site = streamingSite(location.href);
		if (!site) return;

		// Fallback when the background reaches this tab without the watch port.
		browser.runtime.onMessage.addListener((value: unknown) => {
			const notice = readCompanionLoggedNotice(value);
			if (!notice) return;
			handleLoggedNotice(notice);
		});

		// The vendored Netflix helper calls fetch(). Cookies only ride along
		// when the extension asks for them explicitly.
		if (site === "netflix") globalThis.fetch = withPageCookies as typeof fetch;

		const catalog = siteCatalog(site);
		const defaults = settingDefaults(catalog.settings);
		const stored = await browser.storage.local.get(COMPANION_SETTINGS_KEY);
		const saved = parseStoredSettings(stored[COMPANION_SETTINGS_KEY]);
		let toastState: WatchToastState = emptyWatchToastState();
		configurePresenceRuntime({
			service: catalog.service,
			settings: mergeSettingOverrides(defaults, saved[site]),
			emit: (message) => {
				const withPath =
					message.type === "sense-companion:activity"
						? { ...message, pagePath: location.pathname }
						: message;
				const watch =
					message.type === "sense-companion:clear"
						? null
						: popupWatchFromMessage(message);
				const next = nextWatchToast(toastState, watch);
				toastState = next.state;
				const paused =
					message.type === "sense-companion:activity" &&
					activityIsPaused(message.activity);
				paintAutolog(withPath, paused);
				if (next.show && watch && message.type === "sense-companion:activity") {
					const copy = watchToastCopy(watch, next.resume);
					const noticeKey = next.state.key;
					const wasPlaying = watch.mode === "playing";
					// Every confirm paints its own mark. Only a success
					// may reveal the countdown, including after a pairing timeout.
					// A later pause replaces the playing key, so this save must not
					// paint Watching over that pause.
					const delivery = confirmWatchDelivery(message).then((ok) => {
						if (
							!wasPlaying ||
							playingNoticeStillCurrent(toastState.key, noticeKey)
						) {
							showWatchToast(copy, ok);
						}
						if (ok) {
							repaintAutolog(true);
							return;
						}
						releaseAutologProbe(delivery);
					});
					if (autologPaired === null && autologProbe == null) {
						autologProbe = delivery;
					}
					return;
				}
				// A paired save can reveal the pill before the next playback tick.
				// Two misses stop the silent checks. A later Watching confirm can
				// still learn pairing.
				if (
					autologPaired === null &&
					autologProbe == null &&
					autologProbeAttempts < AUTOLOG_PROBE_ATTEMPT_LIMIT &&
					withPath.type === "sense-companion:activity" &&
					withPath.senseMedia != null
				) {
					autologProbeAttempts += 1;
					const delivery = confirmWatchDelivery(withPath).then((ok) => {
						if (ok) {
							repaintAutolog(true);
							return;
						}
						releaseAutologProbe(delivery);
					});
					autologProbe = delivery;
					return;
				}
				postWatch(withPath);
			},
		});

		// Setup toggles apply on the next tick. The page does not reload.
		const onSettingsChanged = (
			changes: Record<string, { newValue?: unknown }>,
			area: string,
		) => {
			if (area !== "local" || !(COMPANION_SETTINGS_KEY in changes)) return;
			const next = parseStoredSettings(
				changes[COMPANION_SETTINGS_KEY]?.newValue,
			);
			replacePresenceSettings(mergeSettingOverrides(defaults, next[site]));
		};
		browser.storage.onChanged.addListener(onSettingsChanged);

		// Site scripts call `new Presence` as a global, the same way PreMiD injected them.
		Object.assign(globalThis, { Presence });
		switch (site) {
			case "netflix":
				await import(
					"../vendor/premid-activities/websites/N/Netflix/presence.ts"
				);
				break;
			case "disney":
				await import(
					"../vendor/premid-activities/websites/D/Disney+/presence.ts"
				);
				break;
			case "prime":
				await import(
					"../vendor/premid-activities/websites/P/Prime Video/presence.ts"
				);
				break;
			case "apple":
				await import(
					"../vendor/premid-activities/websites/A/Apple TV+/presence.ts"
				);
				break;
			case "max":
				await import(
					"../vendor/premid-activities/websites/H/HBO Max/presence.ts"
				);
				break;
			default: {
				const unreachable: never = site;
				return unreachable;
			}
		}

		const tick = () => {
			void tickPresenceUpdates().catch((error: unknown) => {
				console.error("Sense Companion update failed", error);
			});
		};
		tick();
		const timer = setInterval(tick, UPDATE_INTERVAL_MS);
		ctx.onInvalidated(() => {
			clearInterval(timer);
			browser.storage.onChanged.removeListener(onSettingsChanged);
			// Navigation and tab close both drop this script. The host clears Discord.
			const cleared: CompanionActivityMessage = {
				type: "sense-companion:clear",
				service: catalog.service,
			};
			paintAutolog(cleared, false);
			postWatch(cleared);
		});
	},
});
