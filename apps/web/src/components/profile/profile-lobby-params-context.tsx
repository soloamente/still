"use client";

import { useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import type {
	ProfileSocialTabId,
	ProfileTabId,
} from "@/components/profile/profile-tab-toolbar";
import type { HomeVenue } from "@/lib/home-venue";
import {
	profileLedgerTabFromContent,
	resolveProfileTabFromCounts,
} from "@/lib/profile-lobby-derive";
import {
	buildProfileTabHref,
	type ProfileLedgerTabId,
	type ProfileLobbyOrder,
	parseProfileLobbyFavorites,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
} from "@/lib/profile-lobby-order";

interface ProfileLobbySnapshot {
	order: ProfileLobbyOrder;
	venue: HomeVenue;
	favoritesOnly: boolean;
	toolbarActiveTab: ProfileTabId;
}

interface ProfileLobbyParamsContextValue extends ProfileLobbySnapshot {
	handle: string;
	contentTab: ProfileTabId;
	ledgerTab: ProfileLedgerTabId;
	selectOrder: (order: ProfileLobbyOrder) => void;
	selectVenue: (venue: HomeVenue) => void;
	selectTab: (tab: ProfileTabId) => void;
}

const ProfileLobbyParamsContext =
	createContext<ProfileLobbyParamsContextValue | null>(null);

function snapshotFromSearchParams(
	searchParams: URLSearchParams,
	socialTabs: readonly ProfileSocialTabId[],
	counts: { movies: number; tv: number; likedMovies: number; likedTv: number },
): ProfileLobbySnapshot & {
	contentTab: ProfileTabId;
	ledgerTab: ProfileLedgerTabId;
} {
	const order = parseProfileLobbyOrder(searchParams.get("order"));
	const venue = parseProfileLobbyVenue(searchParams.get("venue"));
	const favoritesOnly = parseProfileLobbyFavorites(
		searchParams.get("favorites"),
	);
	const contentTab = resolveProfileTabFromCounts(
		searchParams.get("tab"),
		socialTabs,
		counts,
	);
	const toolbarActiveTab: ProfileTabId =
		favoritesOnly && socialTabs.includes("favorites")
			? "favorites"
			: contentTab;
	const ledgerTab = profileLedgerTabFromContent(contentTab);
	return {
		order,
		venue,
		favoritesOnly,
		toolbarActiveTab,
		contentTab,
		ledgerTab,
	};
}

export function ProfileLobbyParamsProvider({
	handle,
	socialTabs,
	counts,
	children,
}: {
	handle: string;
	socialTabs: readonly ProfileSocialTabId[];
	counts: { movies: number; tv: number; likedMovies: number; likedTv: number };
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();

	const urlState = useMemo(
		() =>
			snapshotFromSearchParams(
				new URLSearchParams(searchParams.toString()),
				socialTabs,
				counts,
			),
		[searchParams, socialTabs, counts],
	);

	const [pending, setPending] = useState<ProfileLobbySnapshot | null>(null);

	useEffect(() => {
		if (pending == null) return;
		if (
			pending.order === urlState.order &&
			pending.venue === urlState.venue &&
			pending.favoritesOnly === urlState.favoritesOnly &&
			pending.toolbarActiveTab === urlState.toolbarActiveTab
		) {
			setPending(null);
		}
	}, [pending, urlState]);

	const active = pending ?? urlState;

	const contentTab = useMemo(() => {
		if (
			active.toolbarActiveTab === "lists" ||
			active.toolbarActiveTab === "reviews"
		) {
			return active.toolbarActiveTab;
		}
		if (active.toolbarActiveTab === "favorites") {
			return counts.likedMovies > 0 || counts.tv === 0 ? "movies" : "tv";
		}
		if (
			active.toolbarActiveTab === "movies" ||
			active.toolbarActiveTab === "tv"
		) {
			return active.toolbarActiveTab;
		}
		return resolveProfileTabFromCounts(
			searchParams.get("tab"),
			socialTabs,
			counts,
		);
	}, [active.toolbarActiveTab, counts, socialTabs, searchParams]);

	const ledgerTab = profileLedgerTabFromContent(
		contentTab === "lists" || contentTab === "reviews"
			? active.toolbarActiveTab === "tv"
				? "tv"
				: "movies"
			: contentTab,
	);

	const applySnapshot = useCallback(
		(next: ProfileLobbySnapshot) => {
			setPending(next);
			const href =
				next.toolbarActiveTab === "lists" || next.toolbarActiveTab === "reviews"
					? `/profile/${encodeURIComponent(handle)}?tab=${next.toolbarActiveTab}`
					: buildProfileTabHref({
							handle,
							tab: next.toolbarActiveTab,
							order: next.order,
							venue: next.venue,
							favoritesOnly: next.favoritesOnly,
						});
			navigate(href);
		},
		[handle, navigate],
	);

	const selectOrder = useCallback(
		(order: ProfileLobbyOrder) => {
			applySnapshot({ ...active, order });
		},
		[active, applySnapshot],
	);

	const selectVenue = useCallback(
		(venue: HomeVenue) => {
			applySnapshot({ ...active, venue });
		},
		[active, applySnapshot],
	);

	const selectTab = useCallback(
		(tab: ProfileTabId) => {
			const favoritesOnly = tab === "favorites";
			const toolbarActiveTab = tab;
			applySnapshot({
				...active,
				favoritesOnly,
				toolbarActiveTab,
			});
		},
		[active, applySnapshot],
	);

	const value = useMemo(
		(): ProfileLobbyParamsContextValue => ({
			handle,
			order: active.order,
			venue: active.venue,
			favoritesOnly: active.favoritesOnly,
			toolbarActiveTab: active.toolbarActiveTab,
			contentTab,
			ledgerTab,
			selectOrder,
			selectVenue,
			selectTab,
		}),
		[
			handle,
			active,
			contentTab,
			ledgerTab,
			selectOrder,
			selectVenue,
			selectTab,
		],
	);

	return (
		<ProfileLobbyParamsContext.Provider value={value}>
			{children}
		</ProfileLobbyParamsContext.Provider>
	);
}

export function useProfileLobbyParams(): ProfileLobbyParamsContextValue {
	const ctx = useContext(ProfileLobbyParamsContext);
	if (ctx == null) {
		throw new Error(
			"useProfileLobbyParams must be used within ProfileLobbyParamsProvider",
		);
	}
	return ctx;
}
