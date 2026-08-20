import type {
	QuotesLobbyKind,
	QuotesLobbyView,
	QuotesSubmissionStatusFilter,
} from "@/lib/quotes-lobby";

export type QuotesLobbyEmptyCopy = {
	title: string;
	body: string;
	/** Verb-first primary CTA into the catalogue. */
	ctaLabel: string;
};

/** Empty-state copy for `/quotes` — teaches save vs suggest from the title Quotes tab. */
export function quotesLobbyEmptyCopy(opts: {
	view: QuotesLobbyView;
	kind: QuotesLobbyKind;
	status: QuotesSubmissionStatusFilter;
}): QuotesLobbyEmptyCopy {
	const { view, kind, status } = opts;

	if (view === "submitted") {
		return quotesSubmissionEmptyCopy(kind, status);
	}
	return quotesSavedEmptyCopy(kind);
}

function quotesSavedEmptyCopy(kind: QuotesLobbyKind): QuotesLobbyEmptyCopy {
	const ctaLabel = "Browse films & shows";
	switch (kind) {
		case "movie":
			return {
				title: "No saved film quotes yet",
				body: "Open a film, open the Quotes tab, and save lines you want to keep.",
				ctaLabel,
			};
		case "tv":
			return {
				title: "No saved show quotes yet",
				body: "Open a show, pick an episode on the Quotes tab, and save lines you want to remember.",
				ctaLabel,
			};
		default:
			return {
				title: "No saved quotes yet",
				body: "Open a film or show, open the Quotes tab, and save lines you want to keep.",
				ctaLabel,
			};
	}
}

function quotesSubmissionEmptyCopy(
	kind: QuotesLobbyKind,
	status: QuotesSubmissionStatusFilter,
): QuotesLobbyEmptyCopy {
	const ctaLabel = "Browse titles to suggest";

	switch (status) {
		case "pending":
			return {
				title: "No quotes awaiting review",
				body: "Suggest a line from a film or show Quotes tab — it appears here while staff review it.",
				ctaLabel,
			};
		case "approved":
			return {
				title: "No approved submissions yet",
				body: "When staff approve a line you suggested, it shows up here and on the title Quotes tab.",
				ctaLabel,
			};
		case "rejected":
			return {
				title: "No declined submissions",
				body: "If staff decline a suggestion, it appears here with any note they leave.",
				ctaLabel,
			};
		case "all":
			break;
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}

	switch (kind) {
		case "movie":
			return {
				title: "No submitted film quotes yet",
				body: "Missing a line on a film? Suggest it from the Quotes tab — staff review before it goes live.",
				ctaLabel,
			};
		case "tv":
			return {
				title: "No submitted show quotes yet",
				body: "Missing a line on a show? Suggest it from the Quotes tab — staff review before it goes live.",
				ctaLabel,
			};
		default:
			return {
				title: "No submissions yet",
				body: "Missing a line? Suggest it from a film or show Quotes tab — staff review before it goes live.",
				ctaLabel,
			};
	}
}
