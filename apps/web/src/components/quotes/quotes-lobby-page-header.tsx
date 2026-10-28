import { cn } from "@still/ui/lib/utils";

import type { QuotesLobbyView } from "@/lib/quotes-lobby";

const QUOTES_LOBBY_PAGE_HEADER_COPY: Record<
	QuotesLobbyView,
	{ title: string; subtitle: string }
> = {
	saved: {
		title: "Saved quotes",
		subtitle: "Community creations and leaderboards",
	},
	submitted: {
		title: "Submissions",
		subtitle: "Quotes you suggested for films and shows",
	},
};

/** Figma 4523:467 — centered title block above the lobby card. */
export function QuotesLobbyPageHeader({
	view,
	className,
}: {
	view: QuotesLobbyView;
	className?: string;
}) {
	const { title, subtitle } = QUOTES_LOBBY_PAGE_HEADER_COPY[view];

	return (
		<header
			className={cn(
				"flex w-full flex-col items-center justify-center gap-[0.9375rem] px-4 text-center",
				className,
			)}
		>
			<h1 className="text-balance font-medium text-[2.75rem] text-foreground leading-none tracking-[-0.04em]">
				{title}
			</h1>
			<p className="text-pretty text-base text-muted-foreground leading-snug">
				{subtitle}
			</p>
		</header>
	);
}
