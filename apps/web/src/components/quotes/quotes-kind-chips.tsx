"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	buildQuotesLobbyHref,
	parseQuotesLobbyKind,
	type QuotesLobbyKind,
} from "@/lib/quotes-lobby";

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
	const searchParams = useSearchParams();
	const lobbyNav = useLobbyNavigationOptional();
	const kind = parseQuotesLobbyKind(searchParams.get("kind"));

	function selectKind(next: QuotesLobbyKind) {
		const href = buildQuotesLobbyHref({ kind: next });
		if (lobbyNav) {
			lobbyNav.navigate(href);
			return;
		}
		window.history.replaceState(null, "", href);
	}

	if (pathname !== "/quotes") return null;

	return (
		<div className={cn("flex min-w-0 justify-center", className)}>
			<SegmentedPillToolbar
				layoutId="quotes-lobby-kind"
				aria-label="Saved quotes media filter"
				value={kind}
				onChange={selectKind}
				options={KIND_OPTIONS}
				className="mx-auto w-max max-w-full flex-nowrap"
			/>
		</div>
	);
}

/** Signed-out empty state CTA — browse catalogue home. */
export function QuotesLobbyBrowseLink() {
	return (
		<Link
			href="/home"
			className="inline-flex min-h-10 items-center rounded-full bg-foreground px-5 py-2.5 font-medium text-background text-sm transition-transform duration-150 active:scale-[0.96] motion-reduce:active:scale-100"
		>
			Browse films &amp; shows
		</Link>
	);
}
