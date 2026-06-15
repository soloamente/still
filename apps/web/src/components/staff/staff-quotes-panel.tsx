"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { QuoteTvEpisodePicker } from "@/components/quote/quote-tv-episode-picker";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

type StaffQuotesMode = "queue" | "publish";

type ListingKind = "movie" | "tv";

type QuoteSubmissionRow = {
	id: string;
	status: "pending" | "approved" | "rejected";
	body: string;
	speaker: string | null;
	timestampLabel: string | null;
	movieId: number | null;
	tvId: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	listingTitle: string | null;
	submitter: {
		userId: string;
		handle: string | null;
		displayName: string | null;
	};
	createdAt: string;
	staffNote: string | null;
	resolvedQuoteId: string | null;
};

type PublishFormState = {
	kind: ListingKind;
	movieId: string;
	tvId: string;
	seasonNumber: number | null;
	episodeNumber: number | null;
	body: string;
	speaker: string;
	timestamp: string;
};

const EMPTY_PUBLISH_FORM: PublishFormState = {
	kind: "movie",
	movieId: "",
	tvId: "",
	seasonNumber: null,
	episodeNumber: null,
	body: "",
	speaker: "",
	timestamp: "",
};

function submissionListingHref(row: QuoteSubmissionRow): string | null {
	if (row.movieId != null) {
		return `/movies/${row.movieId}?view=quotes`;
	}
	if (
		row.tvId != null &&
		row.seasonNumber != null &&
		row.episodeNumber != null
	) {
		const params = new URLSearchParams({
			view: "quotes",
			season: String(row.seasonNumber),
			episode: String(row.episodeNumber),
		});
		return `/tv/${row.tvId}?${params.toString()}`;
	}
	return null;
}

function publishListingHref(form: PublishFormState): string | null {
	if (form.kind === "movie") {
		const movieId = Number.parseInt(form.movieId, 10);
		if (!Number.isFinite(movieId)) return null;
		return `/movies/${movieId}?view=quotes`;
	}
	const tvId = Number.parseInt(form.tvId, 10);
	if (
		!Number.isFinite(tvId) ||
		form.seasonNumber == null ||
		form.episodeNumber == null
	) {
		return null;
	}
	const params = new URLSearchParams({
		view: "quotes",
		season: String(form.seasonNumber),
		episode: String(form.episodeNumber),
	});
	return `/tv/${tvId}?${params.toString()}`;
}

function formatSubmitter(row: QuoteSubmissionRow): string {
	if (row.submitter.displayName?.trim()) {
		return row.submitter.handle
			? `${row.submitter.displayName} (@${row.submitter.handle})`
			: row.submitter.displayName;
	}
	return row.submitter.handle ? `@${row.submitter.handle}` : "Patron";
}

/**
 * Staff quotes — moderation queue plus direct publish (no patron submission row).
 */
export function StaffQuotesPanel() {
	const [mode, setMode] = useState<StaffQuotesMode>("queue");
	const [submissions, setSubmissions] = useState<QuoteSubmissionRow[]>([]);
	const [loadingQueue, setLoadingQueue] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [rejectNote, setRejectNote] = useState("");
	const [queueBusy, setQueueBusy] = useState(false);
	const [publishForm, setPublishForm] =
		useState<PublishFormState>(EMPTY_PUBLISH_FORM);
	const [publishBusy, setPublishBusy] = useState(false);
	const [importBusy, setImportBusy] = useState(false);
	const fieldIdBase = useId();

	const loadQueue = useCallback(async () => {
		setLoadingQueue(true);
		try {
			const res = await api.api.quotes.submissions.get({
				query: { status: "pending" },
			});
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not load quote submissions"),
				);
				return;
			}
			const data = res.data as unknown as {
				items?: QuoteSubmissionRow[];
			} | null;
			const items = (data?.items ?? []).map((row) => ({
				...row,
				createdAt:
					typeof row.createdAt === "string"
						? row.createdAt
						: new Date(row.createdAt).toISOString(),
			}));
			setSubmissions(items);
			setSelectedId((prev) => {
				if (prev && items.some((row) => row.id === prev)) return prev;
				return items[0]?.id ?? null;
			});
		} catch {
			toast.error("Could not load quote submissions");
		} finally {
			setLoadingQueue(false);
		}
	}, []);

	useEffect(() => {
		void loadQueue();
	}, [loadQueue]);

	const selectedSubmission = selectedId
		? submissions.find((row) => row.id === selectedId)
		: null;

	async function approveSelected() {
		if (!selectedSubmission) return;
		setQueueBusy(true);
		try {
			const res = await api.api.quotes
				.submissions({ id: selectedSubmission.id })
				.approve.post();
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not approve submission"),
				);
				return;
			}
			toast.success("Quote published");
			setRejectNote("");
			await loadQueue();
		} catch {
			toast.error("Approve failed");
		} finally {
			setQueueBusy(false);
		}
	}

	async function rejectSelected() {
		if (!selectedSubmission) return;
		setQueueBusy(true);
		try {
			const res = await api.api.quotes
				.submissions({ id: selectedSubmission.id })
				.reject.post({
					staffNote: rejectNote.trim() || null,
				});
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not reject submission"),
				);
				return;
			}
			toast.success("Submission rejected");
			setRejectNote("");
			await loadQueue();
		} catch {
			toast.error("Reject failed");
		} finally {
			setQueueBusy(false);
		}
	}

	function buildStaffPublishPayload() {
		const body = publishForm.body.trim();
		const speaker = publishForm.speaker.trim();
		const timestamp = publishForm.timestamp.trim();
		if (publishForm.kind === "movie") {
			const movieId = Number.parseInt(publishForm.movieId, 10);
			if (!Number.isFinite(movieId)) {
				throw new Error("Enter a valid TMDb movie id");
			}
			return {
				body,
				speaker: speaker || null,
				timestamp: timestamp || null,
				movieId,
				tvId: null,
				seasonNumber: null,
				episodeNumber: null,
			};
		}
		const tvId = Number.parseInt(publishForm.tvId, 10);
		if (!Number.isFinite(tvId)) {
			throw new Error("Enter a valid TMDb TV id");
		}
		if (publishForm.seasonNumber == null || publishForm.episodeNumber == null) {
			throw new Error("Pick season and episode for TV quotes");
		}
		return {
			body,
			speaker: speaker || null,
			timestamp: timestamp || null,
			movieId: null,
			tvId,
			seasonNumber: publishForm.seasonNumber,
			episodeNumber: publishForm.episodeNumber,
		};
	}

	async function importCatalogForMovie() {
		const movieId = Number.parseInt(publishForm.movieId, 10);
		if (!Number.isFinite(movieId)) {
			toast.error("Enter a valid TMDb movie id");
			return;
		}
		setImportBusy(true);
		try {
			const res = await api.api.quotes.import.post({ movieId });
			if (res.error) {
				toast.error(
					errorMessage(
						res.error.value,
						"Import failed — check QUOTE_API_PROVIDER (moviefamous is free) and QUOTE_IMPORT_ENABLED",
					),
				);
				return;
			}
			const data = res.data as {
				inserted?: number;
				updated?: number;
				skippedProtected?: number;
				skippedListing?: number;
			};
			toast.success(
				`Imported ${data.inserted ?? 0} · updated ${data.updated ?? 0}`,
			);
		} catch {
			toast.error("Import failed");
		} finally {
			setImportBusy(false);
		}
	}

	async function publishStaffQuote() {
		if (!publishForm.body.trim()) {
			toast.error("Quote text is required");
			return;
		}
		setPublishBusy(true);
		try {
			const payload = buildStaffPublishPayload();
			const res = await api.api.quotes.staff.post(payload);
			if (res.error) {
				toast.error(
					errorMessage(
						res.error.value,
						"Could not publish quote — open the title detail once if it is not cached",
					),
				);
				return;
			}
			toast.success("Quote published to catalog");
			setPublishForm(EMPTY_PUBLISH_FORM);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Publish failed";
			toast.error(message);
		} finally {
			setPublishBusy(false);
		}
	}

	const publishPreviewHref = publishListingHref(publishForm);

	return (
		<section className="mb-10">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium text-lg">Quotes</h2>
					<p className="text-muted-foreground text-sm">
						Moderate patron submissions or publish staff lines directly to the
						catalog.
					</p>
				</div>
				<SegmentedPillToolbar
					layoutId="staff-quotes-mode"
					aria-label="Staff quotes mode"
					value={mode}
					onChange={setMode}
					options={[
						{ id: "queue", label: "Queue" },
						{ id: "publish", label: "Publish" },
					]}
				/>
			</div>

			{mode === "queue" ? (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
					<div className="rounded-2xl bg-background p-2">
						{loadingQueue ? (
							<p className="px-2 py-3 text-muted-foreground text-sm">
								Loading…
							</p>
						) : submissions.length === 0 ? (
							<p className="px-2 py-3 text-muted-foreground text-sm">
								No pending submissions.
							</p>
						) : (
							<ul className="space-y-1">
								{submissions.map((row) => {
									const active = row.id === selectedId;
									return (
										<li key={row.id}>
											<button
												type="button"
												className={cn(
													"flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
													active
														? "bg-card text-foreground"
														: "text-muted-foreground [@media(hover:hover)]:hover:bg-card/60 [@media(hover:hover)]:hover:text-foreground",
												)}
												onClick={() => {
													setSelectedId(row.id);
													setRejectNote("");
												}}
											>
												<span className="line-clamp-2 font-medium text-sm">
													{row.body}
												</span>
												<span className="mt-0.5 line-clamp-1 text-[11px]">
													{row.listingTitle ?? "Unknown title"} ·{" "}
													{formatSubmitter(row)}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					<div className="space-y-4 rounded-2xl bg-background p-4 sm:p-5">
						{selectedSubmission ? (
							<>
								<div className="space-y-1">
									<p className="font-medium text-sm">Quote</p>
									<p className="text-pretty text-sm leading-relaxed">
										{selectedSubmission.body}
									</p>
									{selectedSubmission.speaker ? (
										<p className="text-muted-foreground text-sm">
											— {selectedSubmission.speaker}
											{selectedSubmission.timestampLabel
												? ` · ${selectedSubmission.timestampLabel}`
												: null}
										</p>
									) : null}
								</div>

								<div className="space-y-1 text-sm">
									<p>
										<span className="text-muted-foreground">Title:</span>{" "}
										{selectedSubmission.listingTitle ?? "Unknown"}
									</p>
									<p>
										<span className="text-muted-foreground">Submitter:</span>{" "}
										{formatSubmitter(selectedSubmission)}
									</p>
								</div>

								{(() => {
									const href = submissionListingHref(selectedSubmission);
									return href ? (
										<Link
											href={href}
											className="inline-block text-muted-foreground text-sm transition-colors [@media(hover:hover)]:hover:text-foreground"
											target="_blank"
											rel="noopener noreferrer"
										>
											Open Quotes tab
										</Link>
									) : null;
								})()}

								<div className="space-y-2">
									<Label htmlFor={`${fieldIdBase}-reject-note`}>
										Reject note (optional)
									</Label>
									<Textarea
										id={`${fieldIdBase}-reject-note`}
										value={rejectNote}
										onChange={(event) => setRejectNote(event.target.value)}
										rows={3}
										placeholder="Why this quote was not added…"
									/>
								</div>

								<div className="flex flex-wrap items-center gap-2 pt-1">
									<Button
										type="button"
										disabled={queueBusy}
										onClick={() => void approveSelected()}
									>
										Approve
									</Button>
									<Button
										type="button"
										variant="secondary"
										disabled={queueBusy}
										onClick={() => void rejectSelected()}
									>
										Reject
									</Button>
								</div>
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								Select a pending submission to review.
							</p>
						)}
					</div>
				</div>
			) : (
				<form
					className="space-y-4 rounded-2xl bg-background p-4 sm:p-5"
					onSubmit={(event) => {
						event.preventDefault();
						void publishStaffQuote();
					}}
				>
					<div className="space-y-2">
						<p className="font-medium text-sm">Media</p>
						<SegmentedPillToolbar
							layoutId="staff-quotes-media"
							aria-label="Quote listing kind"
							value={publishForm.kind}
							onChange={(kind) =>
								setPublishForm((prev) => ({
									...prev,
									kind,
									seasonNumber: kind === "movie" ? null : prev.seasonNumber,
									episodeNumber: kind === "movie" ? null : prev.episodeNumber,
								}))
							}
							options={[
								{ id: "movie", label: "Film" },
								{ id: "tv", label: "Show" },
							]}
						/>
					</div>

					{publishForm.kind === "movie" ? (
						<div className="space-y-2">
							<Label htmlFor={`${fieldIdBase}-movie-id`}>TMDb movie id</Label>
							<Input
								id={`${fieldIdBase}-movie-id`}
								inputMode="numeric"
								value={publishForm.movieId}
								onChange={(event) =>
									setPublishForm((prev) => ({
										...prev,
										movieId: event.target.value,
									}))
								}
								placeholder="550"
								required
							/>
						</div>
					) : (
						<>
							<div className="space-y-2">
								<Label htmlFor={`${fieldIdBase}-tv-id`}>TMDb TV id</Label>
								<Input
									id={`${fieldIdBase}-tv-id`}
									inputMode="numeric"
									value={publishForm.tvId}
									onChange={(event) =>
										setPublishForm((prev) => ({
											...prev,
											tvId: event.target.value,
											seasonNumber: null,
											episodeNumber: null,
										}))
									}
									placeholder="1399"
									required
								/>
							</div>
							{publishForm.tvId.trim() &&
							Number.isFinite(Number.parseInt(publishForm.tvId, 10)) ? (
								<QuoteTvEpisodePicker
									tvId={Number.parseInt(publishForm.tvId, 10)}
									seasonNumber={publishForm.seasonNumber}
									episodeNumber={publishForm.episodeNumber}
									onSeasonChange={(season) =>
										setPublishForm((prev) => ({
											...prev,
											seasonNumber: season,
											episodeNumber: null,
										}))
									}
									onEpisodeChange={(episode) =>
										setPublishForm((prev) => ({
											...prev,
											episodeNumber: episode,
										}))
									}
									layout="sheet"
								/>
							) : null}
						</>
					)}

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-quote-body`}>Quote</Label>
						<Textarea
							id={`${fieldIdBase}-quote-body`}
							value={publishForm.body}
							onChange={(event) =>
								setPublishForm((prev) => ({
									...prev,
									body: event.target.value,
								}))
							}
							rows={4}
							maxLength={500}
							placeholder="The line patrons will see on the Quotes tab…"
							required
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor={`${fieldIdBase}-speaker`}>
								Speaker (optional)
							</Label>
							<Input
								id={`${fieldIdBase}-speaker`}
								value={publishForm.speaker}
								onChange={(event) =>
									setPublishForm((prev) => ({
										...prev,
										speaker: event.target.value,
									}))
								}
								maxLength={120}
								placeholder="Character or person"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${fieldIdBase}-timestamp`}>
								Timestamp (optional)
							</Label>
							<Input
								id={`${fieldIdBase}-timestamp`}
								value={publishForm.timestamp}
								onChange={(event) =>
									setPublishForm((prev) => ({
										...prev,
										timestamp: event.target.value,
									}))
								}
								placeholder="1:02:03 or 13:54"
							/>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Button type="submit" disabled={publishBusy}>
							Publish to catalog
						</Button>
						{publishForm.kind === "movie" &&
						publishForm.movieId.trim() &&
						Number.isFinite(Number.parseInt(publishForm.movieId, 10)) ? (
							<Button
								type="button"
								variant="secondary"
								disabled={publishBusy || importBusy}
								onClick={() => void importCatalogForMovie()}
							>
								{importBusy ? "Importing…" : "Import from provider"}
							</Button>
						) : null}
						{publishPreviewHref ? (
							<Link
								href={publishPreviewHref}
								className="text-muted-foreground text-sm transition-colors [@media(hover:hover)]:hover:text-foreground"
								target="_blank"
								rel="noopener noreferrer"
							>
								Preview Quotes tab
							</Link>
						) : null}
					</div>
				</form>
			)}
		</section>
	);
}
