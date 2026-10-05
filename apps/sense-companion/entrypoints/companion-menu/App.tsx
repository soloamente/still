import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import {
	type DiscordDesktopStatus,
	discordStatusCopy,
	discordStatusTone,
	requestDiscordStatus,
} from "../../src/discord/native-host";
import type { CompanionStatus } from "../../src/pairing/client";
import {
	PairingPanel,
	senseStatusCopy,
	senseStatusTone,
} from "../../src/popup/pairing-panel";
import { StatusIcon } from "../../src/popup/status-icons";
import {
	formatPopupWatchDetail,
	formatPopupWatchState,
	POPUP_WATCH_STORAGE_KEY,
	type PopupWatch,
	readPopupWatch,
} from "../../src/popup/watch-state";
import { readOnboarded } from "../../src/presence/site-settings";

function openCompanionPage(onboarded: boolean): void {
	const page = onboarded ? "/settings.html" : "/onboarding.html";
	void browser.tabs.create({ url: browser.runtime.getURL(page) });
}

function App() {
	const [status, setStatus] = useState<CompanionStatus | "checking">(
		"checking",
	);
	const [discord, setDiscord] = useState<DiscordDesktopStatus>("checking");
	const [onboarded, setOnboarded] = useState(true);
	const [watch, setWatch] = useState<PopupWatch | null>(null);

	useEffect(() => {
		let cancelled = false;
		void requestDiscordStatus().then((next) => {
			if (!cancelled) setDiscord(next);
		});
		void readOnboarded().then((next) => {
			if (!cancelled) setOnboarded(next);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		void browser.storage.session.get(POPUP_WATCH_STORAGE_KEY).then((stored) => {
			if (!cancelled) setWatch(readPopupWatch(stored[POPUP_WATCH_STORAGE_KEY]));
		});
		const onChanged = (
			changes: Record<string, { newValue?: unknown }>,
			area: string,
		) => {
			if (area !== "session" || !(POPUP_WATCH_STORAGE_KEY in changes)) return;
			setWatch(readPopupWatch(changes[POPUP_WATCH_STORAGE_KEY]?.newValue));
		};
		browser.storage.onChanged.addListener(onChanged);
		return () => {
			cancelled = true;
			browser.storage.onChanged.removeListener(onChanged);
		};
	}, []);

	return (
		<div className="popup">
			<main>
				<header className="popup-head">
					<h1>Sense Companion</h1>
					<div className="status-icons">
						<StatusIcon
							icon="discord"
							tone={discordStatusTone(discord)}
							label={discordStatusCopy(discord)}
						/>
						<StatusIcon
							icon="link"
							tone={senseStatusTone(status)}
							label={senseStatusCopy(status)}
						/>
					</div>
				</header>
				<section className="now-watching" aria-live="polite">
					{watch?.coverUrl ? (
						<img src={watch.coverUrl} alt="" />
					) : watch ? (
						<div className="cover" aria-hidden="true" />
					) : null}
					<div className="now-copy">
						{watch ? (
							<p className="watching-state">{formatPopupWatchState(watch)}</p>
						) : null}
						<p className="title">{watch ? watch.title : "Nothing playing"}</p>
						{watch && formatPopupWatchDetail(watch) ? (
							<p className="hint">{formatPopupWatchDetail(watch)}</p>
						) : watch ? null : (
							<p className="hint">
								Start a title on Netflix, Disney+, Prime Video, Apple TV+, or
								HBO Max.
							</p>
						)}
					</div>
				</section>
				<PairingPanel quiet onStatus={setStatus} />
				<button
					type="button"
					className="secondary"
					onClick={() => openCompanionPage(onboarded)}
				>
					{onboarded ? "Settings" : "Set up"}
				</button>
			</main>
		</div>
	);
}

export default App;
