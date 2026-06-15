"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { QuoteTvEpisodePicker } from "@/components/quote/quote-tv-episode-picker";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { parseQuoteTimestampInput } from "@/lib/quote-timestamp";
import {
	SHEET_FIELD_CLASS,
	SHEET_FIELD_LABEL_CLASS,
	SHEET_PRIMARY_PILL_CLASS,
} from "@/lib/sheet-chrome";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const QUOTE_BODY_MAX = 500;
const QUOTE_SPEAKER_MAX = 120;
export const QUOTE_SUGGEST_FORM_ID = "quote-suggest-form";

/** Patron submission sheet — mirrors create-list / review composer sheet chrome. */
export function QuoteSuggestSheet({
	open,
	onOpenChange,
	listingKind,
	movieId,
	tvId,
	initialSeason,
	initialEpisode,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	listingKind: "movie" | "tv";
	movieId?: number | null;
	tvId?: number | null;
	initialSeason?: number | null;
	initialEpisode?: number | null;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [body, setBody] = useState("");
	const [speaker, setSpeaker] = useState("");
	const [timestamp, setTimestamp] = useState("");
	const [seasonNumber, setSeasonNumber] = useState<number | null>(
		initialSeason ?? null,
	);
	const [episodeNumber, setEpisodeNumber] = useState<number | null>(
		initialEpisode ?? null,
	);
	const [submitting, setSubmitting] = useState(false);

	const scrollFadesKey = `${body.length}-${speaker.length}-${timestamp}-${seasonNumber}-${episodeNumber}-${listingKind}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		scrollFadesKey,
	);

	const resetForm = useCallback(() => {
		setBody("");
		setSpeaker("");
		setTimestamp("");
		setSeasonNumber(initialSeason ?? null);
		setEpisodeNumber(initialEpisode ?? null);
	}, [initialEpisode, initialSeason]);

	const handleOpenChange = useCallback(
		(next: boolean) => {
			if (!next) resetForm();
			onOpenChange(next);
		},
		[onOpenChange, resetForm],
	);

	const canSubmit = body.trim().length > 0;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmedBody = body.trim();
		if (!trimmedBody) {
			toast.error("Quote text is required");
			return;
		}
		if (trimmedBody.length > QUOTE_BODY_MAX) {
			toast.error(`Quote text max ${QUOTE_BODY_MAX} characters`);
			return;
		}
		const trimmedSpeaker = speaker.trim();
		if (trimmedSpeaker.length > QUOTE_SPEAKER_MAX) {
			toast.error(`Speaker max ${QUOTE_SPEAKER_MAX} characters`);
			return;
		}

		try {
			parseQuoteTimestampInput(timestamp);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Invalid timestamp");
			return;
		}

		if (listingKind === "tv") {
			if (seasonNumber == null || episodeNumber == null) {
				toast.error("Choose a season and episode");
				return;
			}
		}

		setSubmitting(true);
		try {
			const res = await api.api.quotes.submit.post({
				body: trimmedBody,
				speaker: trimmedSpeaker || null,
				timestamp: timestamp.trim() || null,
				movieId: listingKind === "movie" ? (movieId ?? null) : null,
				tvId: listingKind === "tv" ? (tvId ?? null) : null,
				seasonNumber: listingKind === "tv" ? seasonNumber : null,
				episodeNumber: listingKind === "tv" ? episodeNumber : null,
			});
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Couldn't submit quote";
				toast.error(message);
				return;
			}
			toast.success("Submitted for review");
			handleOpenChange(false);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={handleOpenChange}
			title="Suggest a quote"
			description="Share a memorable line. Staff review submissions before they appear on the Quotes tab."
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-xl pt-2 pb-10">
						<header className="mx-auto mb-8 max-w-md text-center">
							<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
								Suggest a quote
							</h2>
							<p className="mt-2 text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
								Share a memorable line. Staff review submissions before they
								appear on the Quotes tab.
							</p>
						</header>

						<form
							id={QUOTE_SUGGEST_FORM_ID}
							className="space-y-5"
							onSubmit={(e) => void handleSubmit(e)}
						>
							{listingKind === "tv" && tvId != null ? (
								<fieldset className="mx-auto flex w-full max-w-sm flex-col items-center space-y-3 border-0 p-0">
									<legend className={SHEET_FIELD_LABEL_CLASS}>
										From this episode
									</legend>
									<QuoteTvEpisodePicker
										tvId={tvId}
										seasonNumber={seasonNumber}
										episodeNumber={episodeNumber}
										onSeasonChange={(season) => {
											setSeasonNumber(season);
											setEpisodeNumber(null);
										}}
										onEpisodeChange={setEpisodeNumber}
										disabled={submitting}
										layout="sheet"
									/>
								</fieldset>
							) : null}

							<div className="space-y-2">
								<Label
									htmlFor="quote-suggest-body"
									className={SHEET_FIELD_LABEL_CLASS}
								>
									Quote
								</Label>
								<Textarea
									id="quote-suggest-body"
									value={body}
									onChange={(e) => setBody(e.target.value)}
									placeholder="What's the line?"
									maxLength={QUOTE_BODY_MAX}
									rows={5}
									spellCheck
									className={cn(
										SHEET_FIELD_CLASS,
										"min-h-[10rem] resize-y py-3 leading-relaxed",
									)}
									disabled={submitting}
									required
								/>
								<p className="text-right text-muted-foreground text-xs tabular-nums">
									{body.trim().length.toLocaleString()} /{" "}
									{QUOTE_BODY_MAX.toLocaleString()}
								</p>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="quote-suggest-speaker"
									className={SHEET_FIELD_LABEL_CLASS}
								>
									Speaker (optional)
								</Label>
								<Input
									id="quote-suggest-speaker"
									value={speaker}
									onChange={(e) => setSpeaker(e.target.value)}
									placeholder="Character name"
									maxLength={QUOTE_SPEAKER_MAX}
									className={SHEET_FIELD_CLASS}
									disabled={submitting}
									autoComplete="off"
									spellCheck={false}
								/>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="quote-suggest-timestamp"
									className={SHEET_FIELD_LABEL_CLASS}
								>
									Timestamp (optional)
								</Label>
								<Input
									id="quote-suggest-timestamp"
									value={timestamp}
									onChange={(e) => setTimestamp(e.target.value)}
									placeholder="MM:SS or HH:MM:SS"
									className={cn(SHEET_FIELD_CLASS, "font-mono tabular-nums")}
									disabled={submitting}
									autoComplete="off"
									spellCheck={false}
									inputMode="numeric"
								/>
							</div>
						</form>

						<footer className="mt-8 flex items-center justify-between gap-3 px-1">
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className={cn(
										"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									disabled={submitting}
									onClick={() => handleOpenChange(false)}
								>
									Cancel
								</Button>
							</DetailMotionButtonWrap>
							<DetailMotionButtonWrap>
								<Button
									type="submit"
									form={QUOTE_SUGGEST_FORM_ID}
									variant="default"
									size="pill"
									className={cn(SHEET_PRIMARY_PILL_CLASS, "min-w-[9.5rem]")}
									disabled={!canSubmit || submitting}
								>
									{submitting ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									{submitting ? "Submitting…" : "Submit"}
								</Button>
							</DetailMotionButtonWrap>
						</footer>
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>
		</DetailVaulSheet>
	);
}
