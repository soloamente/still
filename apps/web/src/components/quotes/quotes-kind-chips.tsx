"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { useQuotesLobbyChipState } from "@/components/quotes/quotes-view-chips";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { buildQuotesLobbyHref, type QuotesLobbyKind } from "@/lib/quotes-lobby";

const KIND_OPTIONS: readonly {
	id: QuotesLobbyKind;
	label: string;
}[] = [
	{ id: "all", label: "All" },
	{ id: "movie", label: "Films" },
	{ id: "tv", label: "Shows" },
] as const;

/** Media filter rail on `/quotes` — All · Films · Shows. */
export function QuotesKindChips({ className }: { className?: string }) {
	const pathname = usePathname();
	const lobbyNav = useLobbyNavigationOptional();
	const state = useQuotesLobbyChipState();
	const kind = state.kind;

	function selectKind(next: QuotesLobbyKind) {
		const href = buildQuotesLobbyHref({
			view: state.view,
			kind: next,
			status: state.status,
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
				layoutId="quotes-lobby-kind"
				aria-label="Quotes media filter"
				value={kind}
				onChange={selectKind}
				options={KIND_OPTIONS}
				className="w-max max-w-full flex-nowrap"
			/>
		</div>
	);
}

/** Empty-state CTA — browse catalogue to save or suggest quotes. */
export function QuotesLobbyBrowseLink({
	label = "Browse films & shows",
}: {
	label?: string;
}) {
	return (
		<Link
			href="/home"
			className="inline-flex min-h-10 items-center rounded-full bg-foreground px-5 py-2.5 font-medium text-background text-sm transition-transform duration-150 active:scale-[0.96] motion-reduce:active:scale-100"
		>
			{label}
		</Link>
	);
}
