/** Minimal YouTube IFrame Player API surface used by the taste hero. */
export type YouTubePlayer = {
	destroy: () => void;
	mute: () => void;
	playVideo: () => void;
	getPlayerState: () => number;
};

export type YouTubePlayerEvent = {
	data: number;
	target: YouTubePlayer;
};

type YouTubePlayerOptions = {
	videoId: string;
	width?: string | number;
	height?: string | number;
	playerVars?: Record<string, string | number | undefined>;
	events?: {
		onReady?: (event: YouTubePlayerEvent) => void;
		onStateChange?: (event: YouTubePlayerEvent) => void;
		onError?: (event: YouTubePlayerEvent) => void;
	};
};

type YouTubeNamespace = {
	Player: new (
		element: string | HTMLElement,
		options: YouTubePlayerOptions,
	) => YouTubePlayer;
	PlayerState: {
		UNSTARTED: number;
		ENDED: number;
		PLAYING: number;
		PAUSED: number;
		BUFFERING: number;
		CUED: number;
	};
};

declare global {
	interface Window {
		YT?: YouTubeNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

/** Load `https://www.youtube.com/iframe_api` once for the lobby hero. */
export function ensureYouTubeIframeApi(): Promise<YouTubeNamespace> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("YouTube IFrame API requires a browser"));
	}
	if (window.YT?.Player) {
		return Promise.resolve(window.YT);
	}
	if (youtubeApiPromise) return youtubeApiPromise;

	youtubeApiPromise = new Promise((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT?.Player) {
				resolve(window.YT);
				return;
			}
			reject(new Error("YouTube IFrame API ready without YT.Player"));
		};

		const existing = document.querySelector<HTMLScriptElement>(
			'script[src="https://www.youtube.com/iframe_api"]',
		);
		if (existing) return;

		const script = document.createElement("script");
		script.src = "https://www.youtube.com/iframe_api";
		script.async = true;
		script.onerror = () => {
			youtubeApiPromise = null;
			reject(new Error("Failed to load YouTube IFrame API"));
		};
		document.head.appendChild(script);
	});

	return youtubeApiPromise;
}
