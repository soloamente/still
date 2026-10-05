import { browser } from "wxt/browser";

import { postDiscordHostMessage } from "../src/discord/native-host";
import { linkCompanion, readCompanionProfileUrl } from "../src/pairing/client";
import {
	COMPANION_HEARTBEAT_MIN_INTERVAL_MS,
	companionMediaReadyToLog,
	postCompanionNowWatching,
	shouldSendCompanionHeartbeat,
} from "../src/pairing/now-watching";
import {
	SENSE_COMPANION_API_ORIGIN,
	SENSE_COMPANION_ORIGIN,
} from "../src/pairing/origin";
import {
	isCompanionRateRequest,
	postCompanionLogRating,
} from "../src/pairing/rate-log";
import { chromeCompanionTokenStore } from "../src/pairing/storage";
import {
	POPUP_WATCH_STORAGE_KEY,
	popupWatchFromMessage,
} from "../src/popup/watch-state";
import {
	activityIsPaused,
	type CompanionActivityMessage,
	formatActivityLogLine,
	formatSenseMediaLog,
	isCompanionActivityMessage,
	SENSE_COMPANION_WATCH_PORT,
	type SenseMedia,
} from "../src/presence/activity-log";
import { upgradeArtworkUrl } from "../src/presence/artwork-url";
import {
	parseEpisodeTitleFromStateLine,
	withCompanionEpisodeTitle,
} from "../src/presence/companion-episode-title";
import {
	DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	DISCORD_LAYOUT_STORAGE_KEY,
	type DiscordActivityLayout,
	inferCompanionPresenceMode,
	readDiscordActivityLayout,
	resolveDiscordActivityFromMessage,
} from "../src/presence/discord-layout";
import type { CompanionLoggedNotice } from "../src/presence/logged-notice";
import { companionServiceLogoUrl } from "../src/presence/service-platform-brand";
import { COMPANION_ONBOARDED_KEY } from "../src/presence/site-settings";
import { readWatchToastId, watchDeliveryOk } from "../src/presence/watch-toast";

/** Wake the paired browser often enough that a 90s profile heartbeat does not lapse. */
type GenericPageMeta = {
	title: string;
	service: string;
	artwork: string | null;
	path: string;
};

function isGenericPageMetaGet(
	value: unknown,
): value is { type: "sense-companion:page-meta-get" } {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { type?: unknown }).type === "sense-companion:page-meta-get"
	);
}

function isGenericPageMetaSet(
	value: unknown,
): value is { type: "sense-companion:page-meta" } & GenericPageMeta {
	if (typeof value !== "object" || value === null) return false;
	const message = value as Partial<GenericPageMeta> & { type?: unknown };
	return (
		message.type === "sense-companion:page-meta" &&
		typeof message.title === "string" &&
		typeof message.service === "string" &&
		typeof message.path === "string" &&
		(message.artwork == null || typeof message.artwork === "string")
	);
}

export default defineBackground(() => {
	console.info("Sense Companion ready", { id: browser.runtime.id });

	// Chrome's toolbar window is always square, white, and shadowed, so the icon
	// opens a card on the page. See openCompanionMenu.
	browser.action.onClicked.addListener((tab) => {
		void openCompanionMenu(tab.id);
	});
	let lastPopupKey = "";
	let lastLinkAttemptAt = 0;
	let lastWatchAt: number | null = null;
	let lastWatchKey: string | null = null;
	/** Kept across throttled ticks so the Sense title button does not blink off. */
	let cachedTitleUrl: string | null = null;
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

	let watchPort: Browser.runtime.Port | null = null;

	/** Forward auto-log to the streaming tab (port, tab message, or both). */
	function forwardLoggedNotice(
		notice: CompanionLoggedNotice,
		replyPort?: Browser.runtime.Port,
	): void {
		const payload = { type: "sense-companion:logged" as const, ...notice };
		const port = replyPort ?? watchPort;
		try {
			port?.postMessage(payload);
		} catch {
			if (!replyPort || watchPort === replyPort) watchPort = null;
		}
		const tabId = replyPort?.sender?.tab?.id;
		if (tabId != null) {
			void browser.tabs.sendMessage(tabId, payload).catch(() => {
				// The streaming content script may only listen on the watch port.
			});
		}
	}

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

	browser.runtime.onConnect.addListener((port) => {
		if (port.name !== SENSE_COMPANION_WATCH_PORT) return;
		watchPort = port;
		port.onDisconnect.addListener(() => {
			if (watchPort === port) watchPort = null;
		});
		// The streaming tab holds this port open while a title plays, so a
		// playback tick can still reach Discord after this worker would stop.
		port.onMessage.addListener((message: unknown) => {
			const tabId = port.sender?.tab?.id;
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
			const pending = deliverCompanionMessage(message, port, tabId);
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

	/** Top frame title for a player that lives in a cross-origin iframe. */
	const genericPageMeta = new Map<
		number,
		{ title: string; service: string; artwork: string | null; path: string }
	>();
	/** Last status from each tab. A hidden tab must not keep Discord on the old service. */
	const tabPresence = new Map<number, CompanionActivityMessage>();
	let activeTabId: number | null = null;
	let discordTabId: number | null = null;

	void browser.tabs
		.query({ active: true, lastFocusedWindow: true })
		.then((tabs) => {
			const id = tabs[0]?.id;
			if (typeof id === "number") activeTabId = id;
		});

	function rememberTabPresence(
		tabId: number | undefined,
		message: CompanionActivityMessage,
	): void {
		if (typeof tabId !== "number") return;
		if (message.type === "sense-companion:clear") {
			tabPresence.delete(tabId);
			return;
		}
		tabPresence.set(tabId, message);
	}

	function tabOwnsDiscord(tabId: number | undefined): boolean {
		if (typeof tabId !== "number") return true;
		// The first report can arrive before the active-tab query finishes.
		if (activeTabId == null) {
			activeTabId = tabId;
			return true;
		}
		return tabId === activeTabId;
	}

	/** Show the focused tab, or clear when that tab has nothing to report. */
	function publishFocusedTab(): void {
		const message =
			typeof activeTabId === "number"
				? tabPresence.get(activeTabId)
				: undefined;
		if (!message) {
			discordTabId = null;
			lastPopupKey = "";
			postDiscordHostMessage({
				type: "sense-companion:clear",
				service: "Sense",
			});
			void browser.storage.session
				.remove(POPUP_WATCH_STORAGE_KEY)
				.catch((error: unknown) => {
					console.error("Sense Companion popup watch failed", error);
				});
			return;
		}
		void deliverCompanionMessage(message, undefined, activeTabId ?? undefined);
	}

	browser.tabs.onActivated.addListener(({ tabId }) => {
		activeTabId = tabId;
		publishFocusedTab();
	});

	browser.windows.onFocusChanged.addListener((windowId) => {
		if (windowId === browser.windows.WINDOW_ID_NONE) return;
		void browser.tabs.query({ active: true, windowId }).then((tabs) => {
			const id = tabs[0]?.id;
			if (typeof id !== "number") return;
			activeTabId = id;
			publishFocusedTab();
		});
	});

	browser.tabs.onRemoved.addListener((tabId) => {
		genericPageMeta.delete(tabId);
		tabPresence.delete(tabId);
		if (tabId !== discordTabId && tabId !== activeTabId) return;
		publishFocusedTab();
	});

	browser.runtime.onMessage.addListener((message: unknown, sender) => {
		if (isGenericPageMetaGet(message)) {
			const tabId = sender.tab?.id;
			return Promise.resolve(
				tabId == null ? null : (genericPageMeta.get(tabId) ?? null),
			);
		}
		if (isGenericPageMetaSet(message) && sender.tab?.id != null) {
			genericPageMeta.set(sender.tab.id, {
				title: message.title,
				service: message.service,
				artwork: message.artwork,
				path: message.path,
			});
			return;
		}
		const pending = deliverCompanionMessage(message, undefined, sender.tab?.id);
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

	function prepareDiscordActivity(
		message: Parameters<typeof popupWatchFromMessage>[0],
		layout: DiscordActivityLayout,
	) {
		if (message.type !== "sense-companion:activity") return message;
		const mode = inferCompanionPresenceMode(message);
		const poster =
			layout.cover === "none"
				? null
				: upgradeArtworkUrl(message.activity.largeImageKey);
		const brandLogo =
			mode === "sense" ? null : companionServiceLogoUrl(message.service);
		return {
			...message,
			activity: {
				...message.activity,
				largeImageKey: poster ?? brandLogo,
			},
			discordFields:
				resolveDiscordActivityFromMessage(message, layout) ?? undefined,
			// Attach only when Settings keeps the profile button visible.
			...(layout.profileButton === "show"
				? { profileButtonUrl: cachedProfileUrl }
				: {}),
		};
	}

	function deliverCompanionMessage(
		message: unknown,
		replyPort?: Browser.runtime.Port,
		tabId?: number,
	): Promise<boolean> | undefined {
		if (!isCompanionActivityMessage(message)) return;
		rememberTabPresence(tabId, message);
		console.info(formatActivityLogLine(message));
		if (message.type === "sense-companion:activity" && message.senseMedia) {
			console.info(formatSenseMediaLog(message.senseMedia));
		}
		// The popup reads this on open. A background tab must not replace it.
		const focused = tabOwnsDiscord(tabId);
		const watch = focused ? popupWatchFromMessage(message) : null;
		const nextPopupKey = watch
			? `${watch.service}\0${watch.title}\0${watch.season ?? ""}\0${watch.episode ?? ""}\0${watch.mode}\0${watch.coverUrl ?? ""}`
			: "";
		if (focused && nextPopupKey !== lastPopupKey) {
			lastPopupKey = nextPopupKey;
			const write = watch
				? browser.storage.session.set({ [POPUP_WATCH_STORAGE_KEY]: watch })
				: browser.storage.session.remove(POPUP_WATCH_STORAGE_KEY);
			void write.catch((error: unknown) => {
				console.error("Sense Companion popup watch failed", error);
			});
		}
		// This browser saves the title it is playing and updates Discord desktop
		// over the local websocket IPC (no separate helper install).
		return Promise.all([tokenForProfile(), refreshCachedProfileUrl()]).then(
			async ([token]) => {
				const prepared = prepareDiscordActivity(message, discordLayout);
				const saved = await saveNowWatching(prepared, token);
				const withTitle =
					saved.titleUrl && prepared.type === "sense-companion:activity"
						? { ...prepared, titleButtonUrl: saved.titleUrl }
						: prepared;
				if (saved.logged) forwardLoggedNotice(saved.logged, replyPort);
				// A hidden tab can finish after the focused one. Ignore it.
				if (!tabOwnsDiscord(tabId)) {
					return (
						message.type === "sense-companion:activity" &&
						watchDeliveryOk({
							paired: token != null,
							posted: saved.status === "sent",
						})
					);
				}
				postDiscordHostMessage(withTitle);
				discordTabId =
					typeof tabId === "number" &&
					message.type === "sense-companion:activity"
						? tabId
						: null;
				return (
					message.type === "sense-companion:activity" &&
					watchDeliveryOk({
						paired: token != null,
						posted: saved.status === "sent",
					})
				);
			},
		);
	}

	/** Send episode names on the profile heartbeat when the page only set season/episode. */
	function enrichSenseMediaForProfile(
		media: SenseMedia,
		message: CompanionActivityMessage & {
			discordFields?: { state?: string | null };
		},
	): SenseMedia {
		if (message.type !== "sense-companion:activity") return media;
		let next: SenseMedia = {
			...media,
			...withCompanionEpisodeTitle(media, message.activity),
		};
		if (
			next.kind === "episode" &&
			!next.episodeTitle &&
			message.discordFields?.state
		) {
			const parsed = parseEpisodeTitleFromStateLine(
				message.discordFields.state,
				next.title,
			);
			if (parsed) next = { ...next, episodeTitle: parsed };
		}
		return next;
	}

	async function saveNowWatching(
		message: CompanionActivityMessage & {
			profileButtonUrl?: string | null;
			discordFields?: { state?: string | null };
		},
		token: string | null,
	): Promise<Awaited<ReturnType<typeof postCompanionNowWatching>>> {
		if (!token) return { status: "skipped", logged: null, titleUrl: null };
		const clear =
			message.type === "sense-companion:clear" || message.senseMedia == null;
		const rawMedia =
			message.type === "sense-companion:activity" ? message.senseMedia : null;
		const media =
			rawMedia != null && message.type === "sense-companion:activity"
				? enrichSenseMediaForProfile(rawMedia, message)
				: null;
		const paused =
			message.type === "sense-companion:activity" && media
				? activityIsPaused(message.activity)
				: false;
		const nextKey = clear
			? "clear"
			: `${media?.provider}|${media?.kind}|${media?.title}|${media?.season}|${media?.episode}|${paused}`;
		const now = Date.now();
		const forceForAutoLog =
			media != null && !clear && companionMediaReadyToLog(media);
		if (
			!forceForAutoLog &&
			!shouldSendCompanionHeartbeat({
				now,
				lastSentAt: lastWatchAt,
				lastKey: lastWatchKey,
				nextKey,
				minIntervalMs: COMPANION_HEARTBEAT_MIN_INTERVAL_MS,
			})
		) {
			return { status: "sent", logged: null, titleUrl: cachedTitleUrl };
		}
		const saved = await postCompanionNowWatching({
			origin: SENSE_COMPANION_API_ORIGIN,
			store: chromeCompanionTokenStore,
			media: clear ? null : media,
			paused,
			clear,
		});
		if (saved.status === "sent") {
			lastWatchAt = now;
			lastWatchKey = nextKey;
			cachedTitleUrl = clear ? null : saved.titleUrl;
		}
		return saved;
	}
});
