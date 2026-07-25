"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useRef } from "react";

import { isYouTubeEmbedPlaybackBlocked } from "@/lib/home-taste-hero-youtube-embed";
import {
	ensureYouTubeIframeApi,
	type YouTubePlayer,
} from "@/lib/youtube-iframe-api";

/** If autoplay never reaches playing/buffering, treat as blocked (age gate UI). */
const PLAY_WATCHDOG_MS = 4500;

/**
 * Taste-hero YouTube background — uses the IFrame API so age-restricted /
 * non-embeddable videos can fall back to the TMDb backdrop instead of the
 * “only available on YouTube” interstitial.
 */
export function HomeTasteHeroYouTubeTrailer({
	videoId,
	origin,
	className,
	onBlocked,
}: {
	videoId: string;
	origin: string | null;
	className?: string;
	onBlocked: () => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const onBlockedRef = useRef(onBlocked);
	onBlockedRef.current = onBlocked;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		let cancelled = false;
		let player: YouTubePlayer | null = null;
		let watchdog: ReturnType<typeof setTimeout> | null = null;

		const markBlocked = () => {
			if (cancelled) return;
			onBlockedRef.current();
		};

		const clearWatchdog = () => {
			if (watchdog == null) return;
			clearTimeout(watchdog);
			watchdog = null;
		};

		host.replaceChildren();
		const mount = document.createElement("div");
		host.appendChild(mount);

		void ensureYouTubeIframeApi()
			.then((YT) => {
				if (cancelled || !host.contains(mount)) return;

				player = new YT.Player(mount, {
					videoId,
					width: "100%",
					height: "100%",
					playerVars: {
						autoplay: 1,
						mute: 1,
						controls: 0,
						rel: 0,
						modestbranding: 1,
						playsinline: 1,
						loop: 1,
						playlist: videoId,
						iv_load_policy: 3,
						disablekb: 1,
						...(origin ? { origin } : {}),
					},
					events: {
						onError: (event) => {
							if (isYouTubeEmbedPlaybackBlocked(event.data)) {
								markBlocked();
							}
						},
						onReady: (event) => {
							try {
								event.target.mute();
								event.target.playVideo();
							} catch {
								// Autoplay nudge is best-effort; URL playerVars already request it.
							}
							watchdog = setTimeout(() => {
								try {
									const state = event.target.getPlayerState();
									if (
										state !== YT.PlayerState.PLAYING &&
										state !== YT.PlayerState.BUFFERING
									) {
										markBlocked();
									}
								} catch {
									markBlocked();
								}
							}, PLAY_WATCHDOG_MS);
						},
						onStateChange: (event) => {
							if (
								event.data === YT.PlayerState.PLAYING ||
								event.data === YT.PlayerState.BUFFERING
							) {
								clearWatchdog();
							}
						},
					},
				});
			})
			.catch(() => {
				// API script failed — keep silent; plain embed is not mounted in this path.
				markBlocked();
			});

		return () => {
			cancelled = true;
			clearWatchdog();
			try {
				player?.destroy();
			} catch {
				// Player may already be torn down with the host.
			}
			player = null;
			host.replaceChildren();
		};
	}, [origin, videoId]);

	return (
		<div
			ref={hostRef}
			aria-hidden
			className={cn(
				className,
				// YT injects the iframe — stretch it to the same overscan box as before.
				"overflow-hidden [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full [&_iframe]:max-h-none [&_iframe]:max-w-none [&_iframe]:border-0",
			)}
		/>
	);
}
