/** Patron-facing line on browse and playback cards. */
export const DISCORD_TRACKING_WITH_SENSE = "Tracking with Sense";

/**
 * Discord's image proxy cannot fetch Wikimedia, and it crops the artwork to a
 * square. These are public copies of assets/logos, with the mark inset so the
 * word is not cut off.
 */
const SERVICE_LOGOS: Record<string, string> = {
	netflix: "https://files.catbox.moe/gsj0xg.png",
	"disney+": "https://files.catbox.moe/afytic.png",
	disney: "https://files.catbox.moe/afytic.png",
	"prime video": "https://files.catbox.moe/4fb97j.png",
	prime: "https://files.catbox.moe/4fb97j.png",
	"apple tv+": "https://files.catbox.moe/a0hlv0.png",
	apple: "https://files.catbox.moe/a0hlv0.png",
	"hbo max": "https://files.catbox.moe/lli45s.png",
	max: "https://files.catbox.moe/lli45s.png",
};

function normalizeServiceKey(service: string): string {
	return service.trim().toLowerCase();
}

/** Display name under Discord's Watching label for browse rows. */
export function companionServiceDisplayName(service: string): string {
	const key = normalizeServiceKey(service);
	if (key === "max" || key === "hbo max") return "HBO Max";
	if (key === "prime" || key === "prime video") return "Prime Video";
	if (key === "apple" || key === "apple tv+") return "Apple TV+";
	if (key === "disney" || key === "disney+") return "Disney+";
	if (key === "sense") return "Sense";
	return service.trim() || "Sense";
}

export function companionServiceLogoUrl(service: string): string | null {
	const key = normalizeServiceKey(service);
	return (
		SERVICE_LOGOS[key] ??
		SERVICE_LOGOS[companionServiceDisplayName(service).toLowerCase()] ??
		null
	);
}

/** Wide marks from before the square inset. Discord still crops these. */
const LEGACY_SERVICE_LOGO_URLS = new Set([
	"https://files.catbox.moe/sdvc7g.png",
	"https://files.catbox.moe/kqsn6m.png",
	"https://files.catbox.moe/s488hi.png",
	"https://files.catbox.moe/09or0g.png",
	"https://files.catbox.moe/jgcoos.png",
]);

/** True when the URL is a platform mark, including an older full-bleed copy. */
export function isCompanionServiceLogoUrl(value: string): boolean {
	if (Object.values(SERVICE_LOGOS).includes(value)) return true;
	if (LEGACY_SERVICE_LOGO_URLS.has(value)) return true;
	try {
		const host = new URL(value).hostname.toLowerCase();
		return host === "upload.wikimedia.org" || host.endsWith(".wikimedia.org");
	} catch {
		return false;
	}
}

/** PreMiD placeholders and catalogue stubs — not a real title name. */
export function isGenericBrowseTitle(title: string): boolean {
	const trimmed = title.trim();
	if (!trimmed) return true;
	const lower = trimmed.toLowerCase();
	if (lower === "browse" || lower === "search") return true;
	if (lower === "browsing" || lower.startsWith("browsing")) return true;
	if (lower.includes("browsing genre")) return true;
	if (lower === "watching content" || lower === "viewing a show:") return true;
	if (lower === "viewing a movie:") return true;
	return false;
}

export type BrowsePageKind = "movie" | "tv" | "catalogue" | "title";

/** Path hints from the streaming tab (Max /movie, Netflix /title, etc.). */
export function inferBrowsePageKind(
	pagePath: string | null | undefined,
): BrowsePageKind {
	const path = (pagePath ?? "").toLowerCase();
	if (path.includes("/movie")) return "movie";
	if (path.includes("/show") || path.includes("/series")) return "tv";
	if (path.includes("/title/") || path.includes("/jbv=")) return "title";
	if (path.includes("/search") || path.includes("/browse")) return "catalogue";
	return "catalogue";
}

/**
 * A film or show page, not the movies home or the series catalogue.
 * `/movies` and `/series` are sections. `/movie/{id}` and `/title/{id}` are titles.
 */
export function isStreamingTitlePage(
	pagePath: string | null | undefined,
): boolean {
	const path = (pagePath ?? "").toLowerCase();
	if (
		path.includes("/title/") ||
		path.includes("/jbv=") ||
		path.includes("/entity/") ||
		path.includes("/detail/")
	) {
		return true;
	}
	if (/\/movie\/[^/]+/.test(path)) return true;
	if (/\/show\/[^/]+/.test(path)) return true;
	if (/\/series\/[^/]+/.test(path)) return true;
	return false;
}

/**
 * First Discord row while exploring. The platform stays on the next line,
 * so this names the page: home, the movie catalogue, a title, and so on.
 */
export function browsePlaceLine(input: {
	title: string;
	service: string;
	pagePath?: string | null;
}): string {
	const named = isGenericBrowseTitle(input.title) ? null : input.title;
	if (named) return `Browsing ${named} page`;
	const fromDetails = placePhrase(input.title, input.service);
	if (fromDetails) return fromDetails;
	const path = (input.pagePath ?? "").toLowerCase();
	if (
		path.includes("watchlist") ||
		path.includes("my-list") ||
		path.includes("mylist")
	) {
		return "Browsing watchlist";
	}
	if (path.includes("search")) return "Browsing search";
	if (path.includes("/movies") || path.includes("/films")) {
		return "Browsing the movie catalogue";
	}
	if (
		path.includes("/series") ||
		path.includes("/shows") ||
		path.includes("/tv-shows")
	) {
		return "Browsing the TV catalogue";
	}
	if (
		path.includes("home") ||
		path === "/" ||
		path === "" ||
		/^\/browse\/?$/.test(path)
	) {
		return "Browsing the home page";
	}
	const pageKind = inferBrowsePageKind(input.pagePath);
	switch (pageKind) {
		case "movie":
			return "Browsing movie page";
		case "tv":
			return "Browsing TV page";
		case "title":
			return "Browsing title page";
		case "catalogue":
			return "Browsing...";
		default: {
			const unreachable: never = pageKind;
			return unreachable;
		}
	}
}

/** A "Browsing …" detail that already names a page, not the streaming service. */
function placePhrase(title: string, service: string): string | null {
	const text = title
		.trim()
		.replace(/\.\.\.$/, "")
		.trim();
	if (!text.toLowerCase().startsWith("browsing")) return null;
	const rest = text
		.slice("browsing".length)
		.trim()
		.replace(/^(their|the)\s+/i, "");
	if (!rest || isPlatformPhrase(rest, service)) return null;
	const lower = rest.toLowerCase();
	if (lower === "movies" || lower === "movie")
		return "Browsing the movie catalogue";
	if (lower === "series" || lower === "shows" || lower === "tv") {
		return "Browsing the TV catalogue";
	}
	if (lower === "home" || lower === "home page")
		return "Browsing the home page";
	if (lower === "watchlist" || lower === "my list") return "Browsing watchlist";
	if (lower === "catalogue" || lower === "catalog") return "Browsing...";
	if (lower === "store") return "Browsing the store";
	if (rest.length < 40) return `Browsing ${rest}`;
	return null;
}

function isPlatformPhrase(rest: string, service: string): boolean {
	const value = rest
		.toLowerCase()
		.replace(/\.\.\.$/, "")
		.trim();
	const names = new Set([
		companionServiceDisplayName(service).toLowerCase(),
		service.trim().toLowerCase(),
		"max",
		"hbo max",
	]);
	return names.has(value);
}

export function browsingDetailsLine(input: {
	title: string;
	pageKind: BrowsePageKind;
}): string {
	if (!isGenericBrowseTitle(input.title)) {
		return `Browsing ${input.title} page`;
	}
	switch (input.pageKind) {
		case "movie":
			return "Browsing movie page";
		case "tv":
			return "Browsing TV page";
		case "title":
			return "Browsing title page";
		default:
			return "Browsing catalogue";
	}
}
