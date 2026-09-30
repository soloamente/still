import { browser } from "wxt/browser";

import {
	onCompanionLogged,
	postDiscordHostMessage,
	postHostRelay,
} from "../src/discord/native-host";
import { linkCompanion, readCompanionProfileUrl } from "../src/pairing/client";
import { SENSE_COMPANION_ORIGIN } from "../src/pairing/origin";
import {
	isCompanionRateRequest,
	postCompanionLogRating,
} from "../src/pairing/rate-log";
import { companionSourceId } from "../src/pairing/source-id";
import {
	chromeCompanionSourceIdStore,
	chromeCompanionTokenStore,
} from "../src/pairing/storage";
import {
	POPUP_WATCH_STORAGE_KEY,
	popupWatchFromMessage,
} from "../src/popup/watch-state";
import {
	formatActivityLogLine,
	formatSenseMediaLog,
	isCompanionActivityMessage,
	SENSE_COMPANION_WATCH_PORT,
} from "../src/presence/activity-log";
import { upgradeArtworkUrl } from "../src/presence/artwork-url";
import {
	DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	DISCORD_LAYOUT_STORAGE_KEY,
	type DiscordActivityLayout,
	discordActivityParts,
	readDiscordActivityLayout,
	resolveDiscordActivityFields,
} from "../src/presence/discord-layout";
import { COMPANION_ONBOARDED_KEY } from "../src/presence/site-settings";
import { readWatchToastId, watchDeliveryOk } from "../src/presence/watch-toast";

/** Wake the paired browser often enough that a 90s profile heartbeat does not lapse. */
const RELAY_ALARM = "sense-companion-relay";

export default defineBackground(() => {
	console.info("Sense Companion ready", { id: browser.runtime.id });

	// Chrome's toolbar window is always square, white, and shadowed, so the icon
	// opens a card on the page. See openCompanionMenu.
	browser.action.onClicked.addListener((tab) => {
		void openCompanionMenu(tab.id);
	});
	let lastPopupKey = "";
	let lastLinkAttemptAt = 0;
	let discordLayout: DiscordActivityLayout = DEFAULT_DISCORD_ACTIVITY_LAYOUT;
	/** Cached from GET /api/companion/session. Null when missing or fetch failed. */
	let cachedProfileUrl: string | null = null;
	let lastProfileUrlFetchAt = 0;

	void browser.storage.local.get(DISCORD_LAYOUT_STORAGE_KEY).then((stored) => {
		discordLayout = readDiscordActivityLayout(
			stored[DISCORD_LAYOUT_STORAGE_KEY],
		);
	});
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !(DISCORD_LAYOUT_STORAGE_KEY in changes)) return;
		discordLayout = readDiscordActivityLayout(
			changes[DISCORD_LAYOUT_STORAGE_KEY]?.newValue,
		);
	});

	// Only the first install opens the wizard. Later visits use Settings.
	browser.runtime.onInstalled.addListener((details) => {
		if (details.reason !== "install") return;
		void openOnboardingIfNeeded();
	});

	// This browser may be idle. The other browser can still be playing, and
	// this one is the one that was paired with a code.
	void browser.alarms.create(RELAY_ALARM, { periodInMinutes: 0.5 });
	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name !== RELAY_ALARM) return;
		void sendPairingRelay();
	});
	void sendPairingRelay();

	async function tokenForProfile(): Promise<string | null> {
		const existing = await chromeCompanionTokenStore.get();
		if (existing) return existing;
		const now = Date.now();
		// Playback ticks every second. Linking needs the Sense session once.
		if (now - lastLinkAttemptAt < 30_000) return null;
		lastLinkAttemptAt = now;
		await linkCompanion({ store: chromeCompanionTokenStore });
		return chromeCompanionTokenStore.get();
	}

	/** Refresh the Discord View profile URL. Failure caches null and still forwards. */
	async function refreshCachedProfileUrl(force = false): Promise<void> {
		const now = Date.now();
		// Playback ticks every second. Reuse the last session read for a short window.
		if (!force && now - lastProfileUrlFetchAt < 30_000) return;
		lastProfileUrlFetchAt = now;
		try {
			cachedProfileUrl = await readCompanionProfileUrl({
				origin: SENSE_COMPANION_ORIGIN,
				store: chromeCompanionTokenStore,
			});
		} catch {
			cachedProfileUrl = null;
		}
	}

	let watchPort: Browser.runtime.Port | null = null;
	onCompanionLogged((notice) => {
		try {
			watchPort?.postMessage({ type: "sense-companion:logged", ...notice });
		} catch {
			watchPort = null;
		}
	});

	browser.runtime.onConnect.addListener((port) => {
		if (port.name !== SENSE_COMPANION_WATCH_PORT) return;
		watchPort = port;
		port.onDisconnect.addListener(() => {
			if (watchPort === port) watchPort = null;
		});
		// The streaming tab holds this port open while a title plays, so the
		// helper still receives the title after this worker would otherwise stop.
		port.onMessage.addListener((message: unknown) => {
			if (isCompanionRateRequest(message)) {
				const request = message;
				void postCompanionLogRating({
					store: chromeCompanionTokenStore,
					logId: request.logId,
					rating: request.rating,
				}).then((ok) => {
					try {
						port.postMessage({
							type: "sense-companion:rate-result",
							id: request.id,
							ok,
						});
					} catch {
						// The streaming tab closed before the rating saved.
					}
				});
				return;
			}
			const toastId = readWatchToastId(message);
			const pending = deliverCompanionMessage(message);
			if (!toastId) {
				if (pending) void pending;
				return;
			}
			void Promise.resolve(pending ?? false).then((ok) => {
				try {
					port.postMessage({
						type: "sense-companion:watch-result",
						id: toastId,
						ok,
					});
				} catch {
					// The streaming tab closed before the result arrived.
				}
			});
		});
	});

	browser.runtime.onMessage.addListener((message: unknown) => {
		const pending = deliverCompanionMessage(message);
		if (!pending) return;
		void pending;
		return true;
	});

	async function openCompanionMenu(tabId: number | undefined): Promise<void> {
		if (tabId != null) {
			// Chrome documents a root-relative path with no leading slash, and
			// rejects the slash form with "Could not load file".
			const scriptPaths = ["menu-host.js", "/menu-host.js"] as const;
			for (const file of scriptPaths) {
				try {
					await browser.scripting.executeScript({
						target: { tabId },
						injectImmediately: true,
						files: [file] as unknown as ["/menu-host.js"],
					});
					return;
				} catch (error: unknown) {
					console.error(
						"Sense Companion menu failed to open on the page",
						file,
						error,
					);
				}
			}
		}
		// Pages Chrome will not script (new tab, settings) still get the menu.
		try {
			await browser.action.setPopup({ popup: "/companion-menu.html" });
			await browser.action.openPopup();
		} catch (error: unknown) {
			console.error("Sense Companion popup failed to open", error);
			await browser.action.setPopup({ popup: "" });
		}
	}

	async function openOnboardingIfNeeded(): Promise<void> {
		const stored = await browser.storage.local.get(COMPANION_ONBOARDED_KEY);
		if (stored[COMPANION_ONBOARDED_KEY] === true) return;
		await browser.tabs.create({
			url: browser.runtime.getURL("/onboarding.html"),
		});
	}

	async function sendPairingRelay(): Promise<void> {
		const token = await chromeCompanionTokenStore.get();
		if (!token) return;
		const sourceId = await companionSourceId(chromeCompanionSourceIdStore);
		postHostRelay({
			type: "sense-companion:relay",
			profileToken: token,
			sourceId,
		});
		// Keep the Discord profile button URL warm while this browser is paired.
		void refreshCachedProfileUrl(true);
	}

	function prepareDiscordActivity(
		message: Parameters<typeof popupWatchFromMessage>[0],
		layout: DiscordActivityLayout,
	) {
		if (message.type !== "sense-companion:activity") return message;
		const title =
			message.senseMedia?.title ??
			message.activity.name ??
			message.activity.details;
		const details = message.activity.details?.trim() ?? "";
		const state = message.activity.state?.trim() ?? "";
		const showTitle = title?.trim() ?? "";
		const episodeTitle =
			details.length > 0 && details !== showTitle
				? details
				: state.length > 0 && state !== showTitle
					? state
					: null;
		const parts = discordActivityParts({
			service: message.service,
			title,
			episodeTitle,
			season: message.senseMedia?.season ?? null,
			episode: message.senseMedia?.episode ?? null,
		});
		return {
			...message,
			activity: {
				...message.activity,
				largeImageKey:
					layout.cover === "none"
						? null
						: upgradeArtworkUrl(message.activity.largeImageKey),
			},
			discordFields: parts
				? resolveDiscordActivityFields(layout, parts)
				: undefined,
			// Attach only when Settings keeps the profile button visible.
			...(layout.profileButton === "show"
				? { profileButtonUrl: cachedProfileUrl }
				: {}),
		};
	}

	function deliverCompanionMessage(
		message: unknown,
	): Promise<boolean> | undefined {
		if (!isCompanionActivityMessage(message)) return;
		console.info(formatActivityLogLine(message));
		if (message.type === "sense-companion:activity" && message.senseMedia) {
			console.info(formatSenseMediaLog(message.senseMedia));
		}
		// The popup reads this on open. Skip repeat writes while playback ticks.
		const watch = popupWatchFromMessage(message);
		const nextPopupKey = watch
			? `${watch.service}\0${watch.title}\0${watch.season ?? ""}\0${watch.episode ?? ""}\0${watch.paused}\0${watch.coverUrl ?? ""}`
			: "";
		if (nextPopupKey !== lastPopupKey) {
			lastPopupKey = nextPopupKey;
			const write = watch
				? browser.storage.session.set({ [POPUP_WATCH_STORAGE_KEY]: watch })
				: browser.storage.session.remove(POPUP_WATCH_STORAGE_KEY);
			void write.catch((error: unknown) => {
				console.error("Sense Companion popup watch failed", error);
			});
		}
		// The helper writes this title where the paired browser can read it.
		// Saving stays on the helper so an idle paired browser does not clear
		// a title the other browser is still playing.
		return Promise.all([
			tokenForProfile(),
			companionSourceId(chromeCompanionSourceIdStore),
			refreshCachedProfileUrl(),
		]).then(([token, sourceId]) => {
			const prepared = prepareDiscordActivity(message, discordLayout);
			const posted = postDiscordHostMessage(
				token
					? { ...prepared, profileToken: token, sourceId }
					: { ...prepared, sourceId },
			);
			return (
				message.type === "sense-companion:activity" &&
				watchDeliveryOk({ paired: token != null, posted })
			);
		});
	}
});
