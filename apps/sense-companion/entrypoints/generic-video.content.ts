import { popupWatchFromMessage } from "../src/popup/watch-state";
import {
	type CompanionActivityMessage,
	SENSE_COMPANION_WATCH_PORT,
	type SenseMedia,
} from "../src/presence/activity-log";
import {
	type AutologMediaClock,
	emptyAutologCountdownState,
	nextAutologCountdown,
} from "../src/presence/autolog-countdown";
import { syncAutologCountdownPill } from "../src/presence/autolog-countdown-view";
import {
	cleanWatchTitle,
	isDedicatedCompanionHost,
	pickWatchableVideo,
	seasonEpisodeFromTitle,
	serviceLabelFromHostname,
} from "../src/presence/generic-video";
import {
	type CompanionLoggedNotice,
	readCompanionLoggedNotice,
} from "../src/presence/logged-notice";
import { showLoggedToast } from "../src/presence/logged-toast-view";
import {
	emptyWatchToastState,
	nextWatchToast,
	type WatchToastState,
	watchToastCopy,
} from "../src/presence/watch-toast";
import { showWatchToast } from "../src/presence/watch-toast-view";
import { getTimestamps } from "../vendor/premid-activities/premid/src/functions/getTimestamps";

const TICK_MS = 1000;
/** Silent pairing checks on this page. A third tick must not probe again. */
const AUTOLOG_PROBE_ATTEMPT_LIMIT = 2;
/** A seek or ad break can hide the player for a moment. Don't clear on one miss. */
const CLEAR_AFTER_MISSES = 4;

let watchPort: Browser.runtime.Port | null = null;
let lastLoggedToastId: string | null = null;
/** Countdown for this page. The logged-notice listener and the playback tick share it. */
let autologState = emptyAutologCountdownState();
let autologPaired: boolean | null = null;
let autologLogged = false;
/** Title last seen, including before pairing has stored a countdown key. */
let autologTitleKey: string | null = null;
/** In-flight pairing check. Cleared after a miss so one later tick can retry. */
let autologProbe: Promise<void> | null = null;
/** Silent checks on this page. After two misses, ticks stop probing. */
let autologProbeAttempts = 0;
/** Latest tick, so a late pairing answer repaints the title playing now. */
let autologView: {
	message: CompanionActivityMessage;
	paused: boolean;
} | null = null;

/**
 * A tv notice names an episode. A movie notice names a film.
 * Nothing on screen keeps the latch-and-hide behavior.
 */
function loggedNoticeMatchesScreen(notice: CompanionLoggedNotice): boolean {
	const message = autologView?.message;
	if (message == null || message.type !== "sense-companion:activity")
		return true;
	const media = message.senseMedia;
	if (media == null) return true;
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

function handleLoggedNotice(notice: CompanionLoggedNotice): void {
	if (notice.logId === lastLoggedToastId) return;
	lastLoggedToastId = notice.logId;
	// The rate toast takes the corner. The next title clears this flag.
	// Hide the pill only when this row is the title on screen.
	if (loggedNoticeMatchesScreen(notice)) {
		autologLogged = true;
		syncAutologCountdownPill({ phase: "hidden", remainingSec: null });
	}
	// This player does not store a score. The toast still has to return a promise.
	showLoggedToast(notice, () => Promise.resolve(false));
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

function postWatch(message: CompanionActivityMessage): void {
	try {
		ensureWatchPort().postMessage(message);
	} catch {
		watchPort = null;
		void browser.runtime.sendMessage(message);
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

function httpsArtwork(): string | null {
	const content = document
		.querySelector('meta[property="og:image"]')
		?.getAttribute("content");
	if (content?.startsWith("https://")) return content;
	return null;
}

function pageTitle(): string {
	const og = document
		.querySelector('meta[property="og:title"]')
		?.getAttribute("content");
	return og?.trim() || document.title;
}

/**
 * Any site with a real HTML5 movie or episode, outside the dedicated players.
 * The largest long video on the page (including same-origin frames) is the one we report.
 */
export default defineContentScript({
	matches: ["*://*/*"],
	excludeMatches: [
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
		"http://127.0.0.1:3001/*",
		"http://localhost:3001/*",
		"http://127.0.0.1:3000/*",
		"http://localhost:3000/*",
	],
	allFrames: true,
	runAt: "document_idle",
	main(ctx) {
		if (isDedicatedCompanionHost(location.hostname)) return;

		const service = serviceLabelFromHostname(location.hostname);
		let toastState: WatchToastState = emptyWatchToastState();
		let misses = 0;
		let reporting = false;
		let activeService = service;
		let ticking = false;

		const clear = () => {
			if (!reporting) return;
			reporting = false;
			misses = 0;
			toastState = emptyWatchToastState();
			const message: CompanionActivityMessage = {
				type: "sense-companion:clear",
				service: activeService,
			};
			paintAutolog(message, false);
			postWatch(message);
		};

		const publishPageMeta = () => {
			// The player often lives in an iframe. The top page still has the title.
			if (window.top !== window) return;
			const title = cleanWatchTitle(pageTitle(), service);
			if (!title) return;
			void browser.runtime.sendMessage({
				type: "sense-companion:page-meta",
				title,
				service,
				artwork: httpsArtwork(),
				path: location.pathname,
			});
		};

		const tick = async () => {
			if (ticking) return;
			ticking = true;
			try {
				publishPageMeta();
				const videos = [...document.querySelectorAll("video")];
				const video = pickWatchableVideo(videos);
				if (!video) {
					misses += 1;
					if (misses >= CLEAR_AFTER_MISSES) clear();
					return;
				}
				misses = 0;
				let title = cleanWatchTitle(pageTitle(), service);
				let label = service;
				let artwork = httpsArtwork();
				if (!title && window.top !== window) {
					const meta = (await browser.runtime
						.sendMessage({ type: "sense-companion:page-meta-get" })
						.catch(() => null)) as {
						title?: string;
						service?: string;
						artwork?: string | null;
					} | null;
					if (typeof meta?.title === "string") title = meta.title;
					if (typeof meta?.service === "string" && meta.service.length > 0) {
						label = meta.service;
					}
					if (!artwork && typeof meta?.artwork === "string") {
						artwork = meta.artwork;
					}
				}
				if (!title) return;
				const episode = seasonEpisodeFromTitle(`${title} ${document.title}`);
				const positionSec = Math.floor(video.currentTime);
				const durationSec = Math.floor(video.duration);
				const [startTimestamp, endTimestamp] = getTimestamps(
					video.currentTime,
					video.duration,
				);
				const media: SenseMedia = {
					provider: "web",
					kind: episode.kind,
					title,
					season: episode.season,
					episode: episode.episode,
					positionSec,
					durationSec,
					serviceLabel: label,
				};
				const message: CompanionActivityMessage = {
					type: "sense-companion:activity",
					service: label,
					presenceMode: "playing",
					pagePath: location.pathname,
					senseMedia: media,
					activity: {
						name: title,
						details:
							episode.kind === "episode"
								? `S${episode.season} E${episode.episode}`
								: label,
						state: null,
						largeImageKey: artwork,
						largeImageText: title,
						smallImageKey: video.paused
							? "https://sense.local/pause.png"
							: null,
						smallImageText: video.paused ? "Paused" : "Playing",
						startTimestamp,
						endTimestamp,
						type: 3,
					},
				};
				paintAutolog(message, video.paused);
				const watch = popupWatchFromMessage(message);
				const next = nextWatchToast(toastState, watch);
				toastState = next.state;
				reporting = true;
				activeService = label;
				if (next.show && watch) {
					const copy = watchToastCopy(watch);
					// Every Watching confirm paints its own mark. Only a success
					// may reveal the countdown, including after a pairing timeout.
					const delivery = confirmWatchDelivery(message).then((ok) => {
						showWatchToast(copy, ok);
						if (ok) {
							repaintAutolog(true);
							return;
						}
						releaseAutologProbe(delivery);
					});
					if (autologPaired === null && autologProbe == null) {
						autologProbe = delivery;
					}
				} else if (
					autologPaired === null &&
					autologProbe == null &&
					autologProbeAttempts < AUTOLOG_PROBE_ATTEMPT_LIMIT
				) {
					// No Watching toast on this tick. Two misses stop the silent
					// checks. A later Watching confirm can still learn pairing.
					autologProbeAttempts += 1;
					const delivery = confirmWatchDelivery(message).then((ok) => {
						if (ok) {
							repaintAutolog(true);
							return;
						}
						releaseAutologProbe(delivery);
					});
					autologProbe = delivery;
				} else {
					postWatch(message);
				}
			} finally {
				ticking = false;
			}
		};

		tick();
		const timer = window.setInterval(tick, TICK_MS);
		ctx.onInvalidated(() => {
			window.clearInterval(timer);
			clear();
		});
	},
});
