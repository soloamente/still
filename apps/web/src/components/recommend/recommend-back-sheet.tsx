"use client";

import { Button } from "@still/ui/components/button";
import { Skeleton } from "@still/ui/components/skeleton";
import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	fetchRecommendSuggestions,
	postRecommendation,
} from "@/lib/still-api-fetch";
import {
	RECOMMEND_NOTE_MAX,
	RECOMMEND_REASON_OPTIONS,
	type RecommendPick,
	type RecommendReasonCode,
	type RecommendSuggestion,
	type RecommendTarget,
	recommendSendErrorMessage,
	recommendSuggestionMeta,
	sendRecommendationErrorCode,
} from "@/lib/title-recommendation";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	type CatalogTextSearchListingKind,
	useCatalogTextSearch,
} from "@/lib/use-catalog-text-search";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Search rows shown under the field — the sheet is a quick pick, not a catalogue. */
const SEARCH_RESULT_LIMIT = 6;

const SEARCH_KIND_OPTIONS = [
	{ id: "movie", label: "Films" },
	{ id: "tv", label: "Shows" },
] as const;

/** Tappable title row — suggestion or search hit. */
const PICK_ROW_CLASSNAME = cn(
	"flex w-full min-w-0 select-none items-center gap-3 rounded-2xl bg-background p-2 pr-4 text-left",
	"transition-colors duration-150 ease-out motion-reduce:transition-none",
	"[@media(hover:hover)]:hover:bg-background/70",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

type SuggestionsState =
	| { status: "loading" }
	| { status: "ready"; items: RecommendSuggestion[] }
	| { status: "error" };

function RecommendPoster({
	pathOrUrl,
	title,
	size,
}: {
	pathOrUrl: string | null;
	title: string;
	size: "sm" | "lg";
}) {
	const src = tmdbPosterUrlFromPath(pathOrUrl, size === "lg" ? "w185" : "w92");
	return (
		<span
			className={cn(
				"relative block aspect-2/3 shrink-0 overflow-hidden rounded-lg bg-muted/30",
				size === "lg" ? "w-24" : "w-11",
			)}
		>
			{src ? (
				<Image
					src={src}
					alt={`${title} poster`}
					fill
					sizes={size === "lg" ? "96px" : "44px"}
					className="object-cover"
					unoptimized={isTmdbCdnUrl(src)}
				/>
			) : null}
		</span>
	);
}

function pickFromSuggestion(s: RecommendSuggestion): RecommendPick {
	return {
		mediaKind: s.mediaKind,
		tmdbId: s.tmdbId,
		title: s.title,
		posterPathOrUrl: s.posterPath,
		sensitive: s.sensitive,
	};
}

/**
 * Recommend back — Vaul sheet with the recipient preselected:
 * pick (three suggestions + search) → confirm (optional reason / note) → **Send to {name}**.
 */
export function RecommendBackSheet({
	open,
	target,
	onClose,
	onSent,
}: {
	open: boolean;
	target: RecommendTarget;
	onClose: () => void;
	/** Fires after the server accepted the send (sheet closes itself). */
	onSent?: (pick: RecommendPick) => void;
}) {
	const name = target.recipientName;
	const scrollRef = useRef<HTMLDivElement>(null);
	const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
	const pickHeadingRef = useRef<HTMLHeadingElement>(null);
	const noteId = useId();
	const reasonLegendId = useId();

	const [suggestions, setSuggestions] = useState<SuggestionsState>({
		status: "loading",
	});
	const [query, setQuery] = useState("");
	const [searchKind, setSearchKind] =
		useState<CatalogTextSearchListingKind>("movie");
	const [pick, setPick] = useState<RecommendPick | null>(null);
	const [reason, setReason] = useState<RecommendReasonCode | null>(null);
	const [note, setNote] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** Adult / sensitive title — patron must confirm before the send goes out. */
	const [confirmingSensitive, setConfirmingSensitive] = useState(false);
	/** Skip focusing a heading on first open — Vaul focuses the sheet itself. */
	const stepChangedRef = useRef(false);

	const { results: searchResults, loading: searchLoading } =
		useCatalogTextSearch(query, searchKind);

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		pick ? `confirm:${pick.mediaKind}:${pick.tmdbId}` : `pick:${query}`,
	);

	useEffect(() => {
		if (!open) return;
		const ctrl = new AbortController();
		setSuggestions({ status: "loading" });
		void fetchRecommendSuggestions(target.recipientUserId, {
			signal: ctrl.signal,
		}).then((items) => {
			if (ctrl.signal.aborted) return;
			setSuggestions(
				items == null ? { status: "error" } : { status: "ready", items },
			);
		});
		return () => ctrl.abort();
	}, [open, target.recipientUserId]);

	// Move focus with the step so keyboard / screen-reader users land on the new content.
	useEffect(() => {
		if (!stepChangedRef.current) return;
		if (pick) confirmHeadingRef.current?.focus();
		else pickHeadingRef.current?.focus();
	}, [pick]);

	function handleChoose(next: RecommendPick) {
		stepChangedRef.current = true;
		setPick(next);
		setError(null);
		setConfirmingSensitive(false);
	}

	function handleBackToPick() {
		stepChangedRef.current = true;
		setPick(null);
		setError(null);
		setConfirmingSensitive(false);
	}

	async function send(confirmSensitive: boolean) {
		if (!pick || sending) return;
		if (pick.sensitive && !confirmSensitive) {
			setConfirmingSensitive(true);
			return;
		}
		setSending(true);
		setError(null);
		const trimmedNote = note.trim();
		const res = await postRecommendation({
			recipientUserId: target.recipientUserId,
			...(pick.mediaKind === "movie"
				? { movieId: pick.tmdbId }
				: { tvId: pick.tmdbId }),
			...(reason ? { reasonCode: reason } : {}),
			...(trimmedNote ? { note: trimmedNote } : {}),
			...(confirmSensitive ? { confirmSensitive: true } : {}),
			...(target.answerToRecommendationId
				? { answerToRecommendationId: target.answerToRecommendationId }
				: {}),
		});
		setSending(false);
		if (res.ok) {
			onSent?.(pick);
			onClose();
			return;
		}
		const code = sendRecommendationErrorCode(res.error?.raw);
		// Search hits don't carry the adult flag — the server asks instead.
		if (code === "confirm_sensitive") {
			setConfirmingSensitive(true);
			return;
		}
		setError(recommendSendErrorMessage(code, res.status, name));
	}

	const trimmedQuery = query.trim();

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			appStack
			title={`Recommend something to ${name}`}
			description="Pick a film or show, add an optional note, and send it."
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
						{pick == null ? (
							<>
								<h2
									ref={pickHeadingRef}
									tabIndex={-1}
									className="text-balance font-semibold text-foreground text-xl tracking-tight outline-none"
								>
									What should {name} watch next?
								</h2>

								<section
									aria-label="Suggestions"
									className="flex flex-col gap-2"
								>
									{suggestions.status === "loading" ? (
										<div className="flex flex-col gap-2" aria-hidden>
											{[0, 1, 2].map((key) => (
												<Skeleton
													key={key}
													className="h-[4.75rem] w-full rounded-2xl bg-background"
												/>
											))}
										</div>
									) : suggestions.status === "error" ? (
										<p className="text-muted-foreground text-sm">
											Couldn’t load suggestions — search for a title instead.
										</p>
									) : suggestions.items.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											Rate a few favorites and they’ll show up here. For now,
											search for a title.
										</p>
									) : (
										<ul className="flex flex-col gap-2">
											{suggestions.items.map((s) => (
												<li key={`${s.mediaKind}:${s.tmdbId}`}>
													<button
														type="button"
														className={PICK_ROW_CLASSNAME}
														onClick={() => handleChoose(pickFromSuggestion(s))}
													>
														<RecommendPoster
															pathOrUrl={s.posterPath}
															title={s.title}
															size="sm"
														/>
														<span className="flex min-w-0 flex-1 flex-col gap-0.5">
															<span className="truncate font-medium text-foreground">
																{s.title}
															</span>
															<span className="truncate text-muted-foreground text-sm tabular-nums">
																{recommendSuggestionMeta(s)}
															</span>
														</span>
														{s.alreadyWatchedVisible ? (
															<span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-muted-foreground text-xs">
																Already watched
															</span>
														) : null}
													</button>
												</li>
											))}
										</ul>
									)}
								</section>

								<section
									aria-label="Search titles"
									className="flex flex-col gap-3"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<label
											htmlFor={`${noteId}-search`}
											className="font-medium text-foreground text-sm"
										>
											Search titles
										</label>
										<SegmentedPillToolbar
											layoutId={`${noteId}-search-kind`}
											aria-label="Search films or shows"
											value={searchKind}
											onChange={setSearchKind}
											options={SEARCH_KIND_OPTIONS}
											compact
										/>
									</div>
									<div className="relative">
										<Search
											className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
											aria-hidden
										/>
										<input
											id={`${noteId}-search`}
											type="search"
											value={query}
											onChange={(e) => setQuery(e.target.value)}
											placeholder={
												searchKind === "movie" ? "Find a film" : "Find a show"
											}
											autoComplete="off"
											spellCheck={false}
											className="h-12 w-full rounded-full bg-background pr-4 pl-11 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
										/>
									</div>
									{trimmedQuery ? (
										searchLoading && searchResults.length === 0 ? (
											<p
												className="text-muted-foreground text-sm"
												role="status"
											>
												Searching…
											</p>
										) : searchResults.length === 0 ? (
											<p
												className="text-muted-foreground text-sm"
												role="status"
											>
												No matches for “{trimmedQuery}”.
											</p>
										) : (
											<ul className="flex flex-col gap-2">
												{searchResults
													.slice(0, SEARCH_RESULT_LIMIT)
													.map((hit) => {
														const year = (
															hit.release_date ?? hit.first_air_date
														)?.slice(0, 4);
														return (
															<li key={`${searchKind}:${hit.id}`}>
																<button
																	type="button"
																	className={PICK_ROW_CLASSNAME}
																	onClick={() =>
																		handleChoose({
																			mediaKind: searchKind,
																			tmdbId: hit.id,
																			title: hit.title,
																			posterPathOrUrl: hit.poster_url,
																			sensitive: false,
																		})
																	}
																>
																	<RecommendPoster
																		pathOrUrl={hit.poster_url}
																		title={hit.title}
																		size="sm"
																	/>
																	<span className="flex min-w-0 flex-1 flex-col gap-0.5">
																		<span className="truncate font-medium text-foreground">
																			{hit.title}
																		</span>
																		{year ? (
																			<span className="text-muted-foreground text-sm tabular-nums">
																				{year}
																			</span>
																		) : null}
																	</span>
																</button>
															</li>
														);
													})}
											</ul>
										)
									) : null}
								</section>
							</>
						) : (
							<>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="-ml-2 rounded-full"
										onClick={handleBackToPick}
										disabled={sending}
									>
										<ChevronLeft className="size-4" aria-hidden />
										Choose another
									</Button>
								</div>

								<div className="flex items-center gap-4">
									<RecommendPoster
										pathOrUrl={pick.posterPathOrUrl}
										title={pick.title}
										size="lg"
									/>
									<div className="flex min-w-0 flex-col gap-1">
										<p className="text-muted-foreground text-sm">For {name}</p>
										<h2
											ref={confirmHeadingRef}
											tabIndex={-1}
											className="text-balance font-semibold text-foreground text-xl tracking-tight outline-none"
										>
											{pick.title}
										</h2>
									</div>
								</div>

								<fieldset
									className="m-0 flex flex-col gap-2 border-0 p-0"
									aria-labelledby={reasonLegendId}
								>
									<legend
										id={reasonLegendId}
										className="float-left mb-2 w-full p-0 font-medium text-foreground text-sm"
									>
										Why? <span className="text-muted-foreground">Optional</span>
									</legend>
									<div className="flex flex-wrap gap-2">
										{RECOMMEND_REASON_OPTIONS.map((option) => {
											const active = reason === option.id;
											return (
												<button
													key={option.id}
													type="button"
													aria-pressed={active}
													onClick={() => setReason(active ? null : option.id)}
													className={cn(
														"select-none rounded-full px-3.5 py-2 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
														"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														active
															? "bg-foreground text-background"
															: "bg-background text-foreground [@media(hover:hover)]:hover:bg-background/70",
													)}
												>
													{option.label}
												</button>
											);
										})}
									</div>
								</fieldset>

								<div className="flex flex-col gap-2">
									<div className="flex items-baseline justify-between gap-2">
										<label
											htmlFor={noteId}
											className="font-medium text-foreground text-sm"
										>
											Add a note{" "}
											<span className="text-muted-foreground">Optional</span>
										</label>
										<span className="text-muted-foreground text-xs tabular-nums">
											{note.length}/{RECOMMEND_NOTE_MAX}
										</span>
									</div>
									<textarea
										id={noteId}
										value={note}
										onChange={(e) => setNote(e.target.value)}
										maxLength={RECOMMEND_NOTE_MAX}
										rows={3}
										placeholder={`Tell ${name} why`}
										className="w-full resize-none rounded-2xl bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
									/>
								</div>

								{confirmingSensitive ? (
									<div
										className="flex flex-col gap-3 rounded-2xl bg-background p-4"
										role="alertdialog"
										aria-labelledby={`${noteId}-sensitive`}
									>
										<p
											id={`${noteId}-sensitive`}
											className="text-pretty text-foreground text-sm"
										>
											This title is marked for mature audiences. {name}’s
											notification won’t show its title, poster, or your note.
										</p>
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												size="pill"
												onClick={() => void send(true)}
												disabled={sending}
											>
												{sending ? "Sending…" : "Send anyway"}
											</Button>
											<Button
												type="button"
												size="pill"
												variant="secondary"
												onClick={() => setConfirmingSensitive(false)}
												disabled={sending}
											>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<Button
										type="button"
										size="pill"
										className="self-stretch sm:self-start"
										onClick={() => void send(false)}
										disabled={sending}
									>
										{sending ? "Sending…" : `Send to ${name}`}
									</Button>
								)}

								<p
									className="min-h-5 text-destructive text-sm"
									role="status"
									aria-live="polite"
								>
									{error}
								</p>
							</>
						)}
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
				/>
			</div>
		</DetailVaulSheet>
	);
}
