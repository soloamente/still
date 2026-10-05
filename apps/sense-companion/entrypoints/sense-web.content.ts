import type { CompanionActivityMessage } from "../src/presence/activity-log";
import { browsingDetailsLine } from "../src/presence/service-platform-brand";

/** Sense web app routes the extension can describe on Discord. */
type SenseRoute =
	| { kind: "home"; label: "Home" }
	| { kind: "movies"; id: string; label: "Movie" }
	| { kind: "tv"; id: string; label: "TV show" }
	| { kind: "profile"; handle: string; label: "Profile" }
	| { kind: "diary"; label: "Diary" }
	| { kind: "watchlist"; label: "Watchlist" }
	| { kind: "lists"; label: "Lists" }
	| { kind: "community"; label: "Community" }
	| { kind: "settings"; label: "Settings" }
	| { kind: "other"; label: string };

function parseSenseRoute(pathname: string): SenseRoute {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/" || path === "/home") return { kind: "home", label: "Home" };
	const movie = path.match(/^\/movies\/(\d+)/);
	if (movie) return { kind: "movies", id: movie[1]!, label: "Movie" };
	const tv = path.match(/^\/tv\/(\d+)/);
	if (tv) return { kind: "tv", id: tv[1]!, label: "TV show" };
	const profile = path.match(/^\/profile\/([^/]+)/);
	if (profile) {
		return { kind: "profile", handle: profile[1]!, label: "Profile" };
	}
	if (path.startsWith("/diary")) return { kind: "diary", label: "Diary" };
	if (path.startsWith("/watchlist")) {
		return { kind: "watchlist", label: "Watchlist" };
	}
	if (path.startsWith("/lists")) return { kind: "lists", label: "Lists" };
	if (path === "/quotes") return { kind: "other", label: "Quotes" };
	if (path.startsWith("/achievements")) {
		return { kind: "other", label: "Achievements" };
	}
	if (path.startsWith("/me/settings")) {
		return { kind: "settings", label: "Settings" };
	}
	if (path.includes("browse=community")) {
		return { kind: "community", label: "Community" };
	}
	return { kind: "other", label: "Sense" };
}

/** Strip the product suffix browsers put on document.title. */
function sensePageTitle(): string {
	const raw = document.title.trim();
	const stripped = raw
		.replace(/\s*[·|–-]\s*Sense\s*$/i, "")
		.replace(/\s*\|\s*Sense\s*$/i, "")
		.trim();
	return stripped.length > 0 ? stripped : "Sense";
}

function headlineForRoute(route: SenseRoute): string {
	switch (route.kind) {
		case "home":
			return "Home";
		case "movies":
		case "tv":
			return sensePageTitle();
		case "profile":
			return route.handle.startsWith("@") ? route.handle : `@${route.handle}`;
		case "diary":
		case "watchlist":
		case "lists":
		case "community":
		case "settings":
			return route.label;
		default:
			return route.label;
	}
}

function buildSenseActivity(route: SenseRoute): CompanionActivityMessage {
	const headline = headlineForRoute(route);
	const browseLine =
		route.kind === "movies"
			? browsingDetailsLine({ title: headline, pageKind: "movie" })
			: route.kind === "tv"
				? browsingDetailsLine({ title: headline, pageKind: "tv" })
				: route.kind === "home"
					? "Browsing home"
					: `Browsing ${route.label.toLowerCase()}`;
	return {
		type: "sense-companion:activity",
		service: "Sense",
		presenceMode: "sense",
		senseMedia: null,
		pagePath: location.pathname,
		activity: {
			type: 3,
			name: "Sense",
			details: browseLine,
			state: "Tracking with Sense",
			largeImageKey: null,
			largeImageText: headline,
			smallImageKey: null,
			smallImageText: "On Sense",
			startTimestamp: Math.floor(Date.now() / 1000),
			endTimestamp: null,
		},
	};
}

function sameRoute(a: SenseRoute, b: SenseRoute): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export default defineContentScript({
	matches: ["http://127.0.0.1:3001/*", "http://localhost:3001/*"],
	runAt: "document_idle",
	main(ctx) {
		let lastKey = "";
		let route: SenseRoute = parseSenseRoute(location.pathname);

		const publish = () => {
			route = parseSenseRoute(location.pathname);
			const message = buildSenseActivity(route);
			const key = `${route.kind}:${message.activity.name}:${message.activity.details}`;
			if (key === lastKey) return;
			lastKey = key;
			void browser.runtime.sendMessage(message);
		};

		publish();
		const tick = window.setInterval(publish, 2000);

		const observer = new MutationObserver(() => {
			const next = parseSenseRoute(location.pathname);
			if (!sameRoute(next, route)) publish();
		});
		observer.observe(document.documentElement, {
			subtree: true,
			childList: true,
		});

		window.addEventListener("popstate", publish);
		const pushState = history.pushState.bind(history);
		const replaceState = history.replaceState.bind(history);
		history.pushState = (...args) => {
			pushState(...args);
			publish();
		};
		history.replaceState = (...args) => {
			replaceState(...args);
			publish();
		};

		ctx.onInvalidated(() => {
			window.clearInterval(tick);
			observer.disconnect();
			window.removeEventListener("popstate", publish);
			history.pushState = pushState;
			history.replaceState = replaceState;
			void browser.runtime.sendMessage({
				type: "sense-companion:clear",
				service: "Sense",
			});
		});
	},
});
