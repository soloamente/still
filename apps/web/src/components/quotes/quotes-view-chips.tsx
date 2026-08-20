"use client";

import { cn } from "@still/ui/lib/utils";
import { usePathname, useSearchParams } from "next/navigation";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	buildQuotesLobbyHref,
	parseQuotesLobbyKind,
	parseQuotesLobbyView,
	parseQuotesSubmissionStatusFilter,
	type QuotesLobbyView,
	quotesLobbySearchState,
} from "@/lib/quotes-lobby";

const VIEW_OPTIONS: readonly {
	id: QuotesLobbyView;
	label: string;
}[] = [
	{ id: "saved", label: "Saved" },
	{ id: "submitted", label: "Submitted" },
] as const;

/** Primary `/quotes` collection switch — saved bookmarks vs patron submissions. */
export function QuotesViewChips({ className }: { className?: string }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const lobbyNav = useLobbyNavigationOptional();
	const state = quotesLobbySearchState({
		kind: searchParams.get("kind"),
		view: searchParams.get("view"),
		status: searchParams.get("status"),
	});

	function selectView(next: QuotesLobbyView) {
		const href = buildQuotesLobbyHref({
			view: next,
			kind: state.kind,
			status: next === "submitted" ? state.status : "all",
		});
		if (lobbyNav) {
			lobbyNav.navigate(href);
			return;
		}
		window.history.replaceState(null, "", href);
	}

	if (pathname !== "/quotes") return null;

	return (
		<div className={cn("flex min-w-0 shrink-0", className)}>
			<SegmentedPillToolbar
				layoutId="quotes-lobby-view"
				aria-label="Quotes collection"
				value={state.view}
				onChange={selectView}
				options={VIEW_OPTIONS}
				className="w-max max-w-full flex-nowrap"
			/>
		</div>
	);
}

/** Moderation status filter — visible on the Submitted collection only. */
export function QuotesSubmissionStatusChips({
	className,
}: {
	className?: string;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const lobbyNav = useLobbyNavigationOptional();
	const state = quotesLobbySearchState({
		kind: searchParams.get("kind"),
		view: searchParams.get("view"),
		status: searchParams.get("status"),
	});

	if (pathname !== "/quotes" || state.view !== "submitted") return null;

	const options = [
		{ id: "all" as const, label: "All" },
		{ id: "pending" as const, label: "Pending" },
		{ id: "approved" as const, label: "Approved" },
		{ id: "rejected" as const, label: "Declined" },
	];

	function selectStatus(next: (typeof options)[number]["id"]) {
		const href = buildQuotesLobbyHref({
			view: "submitted",
			kind: state.kind,
			status: next,
		});
		if (lobbyNav) {
			lobbyNav.navigate(href);
			return;
		}
		window.history.replaceState(null, "", href);
	}

	return (
		<div className={cn("flex min-w-0 shrink-0", className)}>
			<SegmentedPillToolbar
				layoutId="quotes-lobby-submission-status"
				aria-label="Submitted quote status"
				value={state.status}
				onChange={selectStatus}
				options={options}
				compact
				className="w-max max-w-full flex-nowrap"
			/>
		</div>
	);
}

/** Read current lobby chips without duplicating search-param parsing. */
export function useQuotesLobbyChipState() {
	const searchParams = useSearchParams();
	return quotesLobbySearchState({
		kind: searchParams.get("kind"),
		view: searchParams.get("view"),
		status: searchParams.get("status"),
	});
}

export {
	parseQuotesLobbyKind,
	parseQuotesLobbyView,
	parseQuotesSubmissionStatusFilter,
};
