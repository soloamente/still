import type { LucideIcon } from "lucide-react";
import {
	Bell,
	Compass,
	Film,
	ListMusic,
	MessageCircle,
	Newspaper,
	TrendingUp,
	Trophy,
} from "lucide-react";

import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

export interface SearchGoToShortcut {
	id: string;
	label: string;
	icon: LucideIcon;
	href: string;
}

/** Launcher destinations for the dedicated Go to dialog (⌘⇧K). */
export const SEARCH_GO_TO_SHORTCUTS: readonly SearchGoToShortcut[] = [
	{ id: "home", label: "Home", icon: Film, href: "/home" },
	{ id: "diary", label: "Diary", icon: Film, href: "/diary" },
	{ id: "watchlist", label: "Watchlist", icon: ListMusic, href: "/watchlist" },
	{ id: "lists", label: "Lists", icon: ListMusic, href: "/lists" },
	{
		id: "popular",
		label: "Popular films",
		icon: TrendingUp,
		href: buildHomeLobbyHref({ browse: "movies", sort: "popular" }),
	},
	{
		id: "discover",
		label: "Discover films",
		icon: Compass,
		href: buildHomeLobbyHref({ browse: "movies", sort: "latest" }),
	},
	{ id: "news", label: "News", icon: Newspaper, href: "/news" },
	{
		id: "achievements",
		label: "Achievements",
		icon: Trophy,
		href: "/achievements",
	},
	{ id: "chat", label: "Chat", icon: MessageCircle, href: "/chat" },
	{
		id: "notifications",
		label: "Notifications",
		icon: Bell,
		href: "/notifications",
	},
] as const;

export function filterGoToShortcuts(query: string): SearchGoToShortcut[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...SEARCH_GO_TO_SHORTCUTS];
	return SEARCH_GO_TO_SHORTCUTS.filter((s) =>
		s.label.toLowerCase().includes(q),
	);
}
