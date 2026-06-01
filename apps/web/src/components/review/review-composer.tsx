"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { LogRatingSlider } from "@/components/log/log-rating-slider";
import {
	DetailMotionButton,
	DetailMotionButtonWrap,
} from "@/components/movie/detail-motion-pressable";
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
import { api } from "@/lib/api";
import { APP_MODAL_POPOVER_POSITIONER_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	clampLogRatingDisplay,
	diaryStoredToReviewApiRating,
	formatStoredLogRatingDisplay,
	logRatingToDisplay,
} from "@/lib/log-rating";

const BODY_MAX = 20_000;
const TITLE_MAX = 200;
const DEFAULT_RATING = 7;

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

type ComposerStep = "compose" | "spoilers";

type ComposerArgs = {
	movieId: number;
	movieTitle: string;
	posterUrl?: string | null;
	/** TMDb or Sense community average on 0–10 for the slider ghost fill. */
	averageRating?: number | null;
	reviewId?: string;
	/** Latest diary log — when rated, review inherits score (no second slider). */
	diaryLogId?: string;
	diaryRatingStored?: number | null;
};

type Store = {
	isOpen: boolean;
	args: ComposerArgs | null;
	open: (args: ComposerArgs) => void;
	close: () => void;
};

export const useReviewComposer = create<Store>((set) => ({
	isOpen: false,
	args: null,
	open: (args) => set({ isOpen: true, args }),
	close: () => set({ isOpen: false, args: null }),
}));

function posterSrcFromPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

/** Integer 1–10 for the reviews API from the log-style 0–10 slider. */
function reviewRatingFromDisplay(display: number): number | undefined {
	const rounded = Math.round(clampLogRatingDisplay(display));
	if (rounded < 1) return undefined;
	return Math.min(10, rounded);
}

/**
 * Cinematic review sheet — mirrors `QuickLogRoot` layout, motion, and footer chrome.
 * Mounted in `AppShell`; open via `useReviewComposer().open()`.
 */
export function ReviewComposerRoot() {
	const reduceMotion = useReducedMotion();
	const { isOpen, args, close } = useReviewComposer();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [ratingDisplay, setRatingDisplay] = useState(DEFAULT_RATING);
	const [containsSpoilers, setContainsSpoilers] = useState(false);
	const [visibility, setVisibility] = useState<ContentVisibility>("public");
	const [visibilityTouched, setVisibilityTouched] = useState(false);
	const [step, setStep] = useState<ComposerStep>("compose");
	const [saving, setSaving] = useState(false);
	const [posterUrl, setPosterUrl] = useState<string | null>(null);
	const [averageRating, setAverageRating] = useState<number | null>(null);
	const [showFooterFade, setShowFooterFade] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	const handleClose = useCallback(() => {
		close();
	}, [close]);

	useEffect(() => {
		if (!isOpen) {
			setTitle("");
			setBody("");
			setRatingDisplay(DEFAULT_RATING);
			setContainsSpoilers(false);
			setVisibility("public");
			setVisibilityTouched(false);
			setStep("compose");
			setPosterUrl(null);
			setAverageRating(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !args) return;
		setPosterUrl(posterSrcFromPath(args.posterUrl) ?? null);
		setAverageRating(args.averageRating ?? null);
		const fromDiary = logRatingToDisplay(args.diaryRatingStored);
		setRatingDisplay(fromDiary ?? DEFAULT_RATING);
	}, [isOpen, args]);

	const diaryScoreLabel = useMemo(() => {
		if (!args) return null;
		return formatStoredLogRatingDisplay(args.diaryRatingStored);
	}, [args]);

	const usesDiaryRating = diaryScoreLabel != null;

	/** Hide the bottom scrim once the user has scrolled to the end of the compose form. */
	const syncFooterFade = useCallback(() => {
		if (step !== "compose") return;
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowFooterFade(distanceFromBottom > 8);
	}, [step]);

	useEffect(() => {
		if (!isOpen) return;
		if (step !== "compose") {
			setShowFooterFade(false);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		syncFooterFade();
		el.addEventListener("scroll", syncFooterFade, { passive: true });
		return () => el.removeEventListener("scroll", syncFooterFade);
	}, [isOpen, step, syncFooterFade]);

	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (step === "spoilers") {
				setStep("compose");
				setContainsSpoilers(false);
				return;
			}
			handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, handleClose, step]);

	const canPublish = useMemo(() => {
		if (!args) return false;
		const trimmed = body.trim();
		if (!trimmed) return false;
		if (body.length > BODY_MAX) return false;
		if (title.length > TITLE_MAX) return false;
		return true;
	}, [args, body, title.length]);

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

	if (!args) return null;

	const spoilerChip = (active: boolean) =>
		cn(
			"inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "bg-foreground text-background"
				: "bg-background text-foreground",
			!active && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		);

	// Sheet fields sit on `bg-card` — suppress default Input/Textarea focus ring and border wash.
	const fieldClass =
		"min-h-11 rounded-2xl border-transparent bg-background text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

	function handlePublishClick() {
		if (!canPublish) return;
		setContainsSpoilers(false);
		setStep("spoilers");
	}

	async function submit() {
		if (!canPublish || !args || step !== "spoilers") return;
		setSaving(true);
		try {
			const rating = usesDiaryRating
				? diaryStoredToReviewApiRating(args.diaryRatingStored)
				: reviewRatingFromDisplay(ratingDisplay);
			await api.api.reviews.post({
				movieId: args.movieId,
				logId: args.diaryLogId,
				title: title.trim() || undefined,
				body: body.trim(),
				rating,
				containsSpoilers,
				...(visibilityTouched ? { visibility } : {}),
			});
			toast.success("Review published");
			handleClose();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't publish — try again");
		} finally {
			setSaving(false);
		}
	}

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className="fixed inset-0 z-50 grid place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center"
					onClick={handleClose}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="review-composer-title"
						layout
						layoutRoot
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{
							duration: 0.18,
							ease: SHEET_EASE,
							layout: dialogLayoutTransition,
						}}
						onClick={(e) => e.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
						style={
							{
								"--log-rating-accent": "oklch(0.72 0.14 250)",
							} as CSSProperties
						}
					>
						<div className="mb-4 flex justify-end">
							<Button
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" />
							</Button>
						</div>

						<div className="relative">
							<div
								ref={scrollRef}
								className="max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								<AnimatePresence mode="wait" initial={false}>
									{step === "compose" ? (
										<motion.div
											key="review-compose"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											transition={{ duration: 0.18, ease: SHEET_EASE }}
										>
											{posterUrl ? (
												<div className="mx-auto mb-5 flex justify-center">
													<div className="relative aspect-[2/3] w-[7.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg">
														<Image
															src={posterUrl}
															alt=""
															fill
															sizes="120px"
															className="object-cover"
															unoptimized
														/>
													</div>
												</div>
											) : null}

											<h2
												id="review-composer-title"
												className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
											>
												Share your review
											</h2>
											<p className="mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
												{args.movieTitle}
											</p>

											{usesDiaryRating ? (
												<p className="mb-6 text-balance text-center text-muted-foreground text-sm leading-relaxed">
													Your score{" "}
													<span className="font-medium text-foreground tabular-nums">
														{diaryScoreLabel}
													</span>{" "}
													from your log carries into this review — no second
													rating step.
												</p>
											) : (
												<LogRatingSlider
													value={clampLogRatingDisplay(ratingDisplay)}
													onChange={setRatingDisplay}
													averageRating={averageRating}
													className="mb-6"
												/>
											)}

											<div className="mb-5 space-y-2">
												<Label
													htmlFor="review-title"
													className="w-full justify-center text-center text-muted-foreground text-xs"
												>
													Headline (optional)
												</Label>
												<Input
													id="review-title"
													value={title}
													onChange={(e) => setTitle(e.target.value)}
													maxLength={TITLE_MAX}
													placeholder="A line for your take"
													autoComplete="off"
													spellCheck
													className={fieldClass}
												/>
											</div>

											<div className="mb-5 space-y-2">
												<Label
													htmlFor="review-body"
													className="w-full justify-center text-center text-muted-foreground text-xs"
												>
													Your review
												</Label>
												<Textarea
													id="review-body"
													value={body}
													onChange={(e) => setBody(e.target.value)}
													rows={6}
													placeholder="What stayed with you?"
													maxLength={BODY_MAX}
													spellCheck
													className={cn(
														fieldClass,
														"min-h-[10rem] resize-y py-3 leading-relaxed",
													)}
												/>
												<p className="text-right text-muted-foreground text-xs tabular-nums">
													{body.length.toLocaleString()} /{" "}
													{BODY_MAX.toLocaleString()}
												</p>
											</div>

											<label
												className="mb-5 flex flex-col gap-1.5 text-sm"
												htmlFor="review-visibility"
											>
												<span className="w-full text-center text-muted-foreground text-xs">
													Who can see this
												</span>
												<VisibilitySelect
													id="review-visibility"
													value={visibility}
													onChange={(next) => {
														setVisibility(next);
														setVisibilityTouched(true);
													}}
													popoverPositionerClassName={
														APP_MODAL_POPOVER_POSITIONER_CLASS
													}
													popoverSide="top"
												/>
											</label>
										</motion.div>
									) : (
										<motion.div
											key="review-spoilers"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											transition={{ duration: 0.18, ease: SHEET_EASE }}
											className="flex flex-col items-center justify-center px-2 py-8"
										>
											<h2
												id="review-composer-title"
												className="mb-3 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
											>
												One last thing
											</h2>
											<p className="mb-8 max-w-sm text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
												Does your review reveal plot details others may not have
												seen yet?
											</p>
											<fieldset className="flex flex-wrap items-center justify-center gap-2 border-0 p-0">
												<legend className="sr-only">Spoiler disclosure</legend>
												<DetailMotionButton
													type="button"
													className={spoilerChip(!containsSpoilers)}
													aria-pressed={!containsSpoilers}
													onClick={() => setContainsSpoilers(false)}
												>
													No spoilers
												</DetailMotionButton>
												<DetailMotionButton
													type="button"
													className={spoilerChip(containsSpoilers)}
													aria-pressed={containsSpoilers}
													onClick={() => setContainsSpoilers(true)}
												>
													Contains spoilers
												</DetailMotionButton>
											</fieldset>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
							{/* Compose-only scrim — sibling of scroll, not measured for layout */}
							{step === "compose" ? (
								<div
									aria-hidden
									className={cn(
										"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
										showFooterFade ? "opacity-100" : "opacity-0",
									)}
								/>
							) : null}
						</div>

						<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className={cn(
										"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									disabled={saving}
									onClick={() => {
										if (step === "spoilers") {
											setStep("compose");
											setContainsSpoilers(false);
											return;
										}
										handleClose();
									}}
								>
									{step === "spoilers" ? "Back" : "Cancel"}
								</Button>
							</DetailMotionButtonWrap>
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="default"
									size="pill"
									className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
									disabled={
										(step === "compose" && !canPublish) ||
										(step === "spoilers" && saving)
									}
									onClick={() => {
										if (step === "compose") {
											handlePublishClick();
											return;
										}
										void submit();
									}}
								>
									{saving ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									{step === "spoilers" ? "Publish now" : "Publish"}
								</Button>
							</DetailMotionButtonWrap>
						</footer>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
