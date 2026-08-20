"use client";

import { HomeLobbyChipPopover } from "@/components/home/home-lobby-chip-popover";
import { HomeLobbyFilterRow } from "@/components/home/home-lobby-filter-row";
import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { QuotesKindChips } from "@/components/quotes/quotes-kind-chips";
import {
	QuotesSubmissionStatusChips,
	QuotesViewChips,
	useQuotesLobbyChipState,
} from "@/components/quotes/quotes-view-chips";
import {
	buildQuotesLobbyHref,
	type QuotesSubmissionStatusFilter,
} from "@/lib/quotes-lobby";

const SUBMISSION_STATUS_OPTIONS: readonly {
	id: QuotesSubmissionStatusFilter;
	label: string;
}[] = [
	{ id: "all", label: "All" },
	{ id: "pending", label: "Pending" },
	{ id: "approved", label: "Approved" },
	{ id: "rejected", label: "Declined" },
] as const;

/**
 * One-line `/quotes` filter chrome — Saved · Submitted leading, All · Films · Shows
 * trailing. On Submitted, status sits in the center rail (`sm+`); mobile uses a popover.
 */
export function QuotesLobbyFilterRow() {
	const lobbyNav = useLobbyNavigationOptional();
	const state = useQuotesLobbyChipState();
	const statusLabel =
		SUBMISSION_STATUS_OPTIONS.find((option) => option.id === state.status)
			?.label ?? "All";
	const onSubmitted = state.view === "submitted";

	function selectStatus(next: QuotesSubmissionStatusFilter) {
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
		<HomeLobbyFilterRow
			leadingScrollKey={`quotes-${state.view}-${state.status}`}
			leading={
				<div className="flex min-w-0 flex-nowrap items-center gap-2">
					<QuotesViewChips />
					{/* Mobile — status popover beside collection chips (center rail is `sm+` only). */}
					{onSubmitted ? (
						<div className="sm:hidden">
							<HomeLobbyChipPopover
								aria-label="Submitted quote status"
								title="Submission status"
								layoutId="quotes-lobby-submission-status-mobile"
								value={state.status}
								options={SUBMISSION_STATUS_OPTIONS}
								onChange={selectStatus}
								triggerLabel={statusLabel}
							/>
						</div>
					) : null}
				</div>
			}
			center={onSubmitted ? <QuotesSubmissionStatusChips /> : undefined}
			trailing={<QuotesKindChips />}
		/>
	);
}
