"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { LogRatingSlider } from "@/components/log/log-rating-slider";
import {
	categoryProgressLabel,
	categorySuggestionAction,
	LOG_CATEGORIES,
	type LogCategoryRatings,
	suggestedOverallFromCategories,
} from "@/lib/log-category-ratings";
import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
	logRatingToStored,
} from "@/lib/log-rating";
import { patchLog } from "@/lib/still-api-fetch";

const PANEL_PILL_CLASSNAME = cn(
	"inline-flex min-h-10 items-center justify-center rounded-full px-4 font-medium text-sm transition-[transform,opacity,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
	"disabled:pointer-events-none disabled:opacity-50",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);
const PANEL_PRIMARY_PILL_CLASSNAME = cn(
	PANEL_PILL_CLASSNAME,
	"bg-foreground text-background",
);
const PANEL_QUIET_PILL_CLASSNAME = cn(
	PANEL_PILL_CLASSNAME,
	"text-foreground/80 [@media(hover:hover)]:hover:text-foreground",
);

type PanelStep =
	| { kind: "collapsed" }
	| { kind: "rating"; index: number }
	| { kind: "finished" };

/**
 * Optional **Rate by category** step in the watch-log flow (Today How was it? +
 * Quick Log celebration). One category at a time; each rated category is saved
 * as soon as the patron moves past it, so closing midway keeps partial progress
 * and never touches the already-saved log. Skipped categories are never stored.
 */
export function LogCategoryRatingsPanel({
	logId,
	overallDisplay,
	onApplySuggestion,
	align = "responsive",
	className,
}: {
	logId: string;
	/** Current overall on 0–10 display, or `null` when the patron hasn't set one. */
	overallDisplay: number | null;
	/** Patron chose the suggested overall — the host decides whether to save it. */
	onApplySuggestion: (display: number) => void;
	/** `responsive` = centered on mobile, start-aligned from `sm` (Today hero); `center` = always centered (sheets). */
	align?: "responsive" | "center";
	className?: string;
}) {
	const actionsRowClassName = cn(
		"flex flex-wrap items-center justify-center gap-2",
		align === "responsive" && "sm:justify-start",
	);
	const regionId = useId();
	const headingId = useId();
	const [step, setStep] = useState<PanelStep>({ kind: "collapsed" });
	const [rated, setRated] = useState<LogCategoryRatings>({});
	const [value, setValue] = useState(0);
	const [touched, setTouched] = useState(false);
	const [saving, setSaving] = useState(false);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const finishedHeadingRef = useRef<HTMLHeadingElement>(null);

	// Next/Done unmount when the summary appears — keep keyboard focus in the panel.
	useEffect(() => {
		if (step.kind === "finished") finishedHeadingRef.current?.focus();
	}, [step.kind]);

	const ratedCount = Object.keys(rated).length;
	const suggestedDisplay = suggestedOverallFromCategories(rated);
	const suggestion = categorySuggestionAction(overallDisplay, suggestedDisplay);

	function goToIndex(index: number) {
		setValue(0);
		setTouched(false);
		setStep(
			index >= LOG_CATEGORIES.length
				? { kind: "finished" }
				: { kind: "rating", index },
		);
	}

	/** Persist the current category (when rated), then advance — or finish on **Done**. */
	async function handleNext(index: number, finish = false) {
		const category = LOG_CATEGORIES[index];
		if (!category || saving) return;
		const advance = () =>
			finish ? setStep({ kind: "finished" }) : goToIndex(index + 1);
		if (!touched) {
			advance();
			return;
		}
		const tenths = logRatingToStored(value);
		if (tenths == null) return;
		setSaving(true);
		try {
			const result = await patchLog(logId, {
				categoryRatings: { [category.key]: tenths },
			});
			if (!result.ok) throw new Error("category patch failed");
			setRated((prev) => ({ ...prev, [category.key]: tenths }));
			advance();
		} catch (err) {
			console.error("[log-categories] save failed", category.key, err);
			toast.error(`Couldn't save your ${category.label.toLowerCase()} rating`);
		} finally {
			setSaving(false);
		}
	}

	function handleClose() {
		setStep({ kind: "collapsed" });
		toggleRef.current?.focus();
	}

	const toggleLabel =
		ratedCount > 0
			? `Rate by category · ${ratedCount} of ${LOG_CATEGORIES.length} rated`
			: "Rate by category · Optional";

	return (
		<div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
			<button
				ref={toggleRef}
				type="button"
				className={cn(
					"inline-flex min-h-10 items-center gap-1.5 self-center rounded-full px-2 font-medium text-foreground/75 text-sm transition-colors duration-200 motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground",
					align === "responsive" && "sm:self-start",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				)}
				aria-expanded={step.kind !== "collapsed"}
				aria-controls={regionId}
				onClick={() =>
					step.kind === "collapsed" ? goToIndex(0) : handleClose()
				}
			>
				{toggleLabel}
				<ChevronDown
					aria-hidden
					className={cn(
						"size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
						step.kind !== "collapsed" && "rotate-180",
					)}
				/>
			</button>

			{step.kind === "collapsed" ? null : (
				<section
					id={regionId}
					aria-labelledby={headingId}
					className="flex flex-col gap-3"
				>
					{step.kind === "rating" ? (
						<>
							<div className="flex items-baseline justify-between gap-3">
								<h4
									id={headingId}
									className="font-semibold text-base text-foreground"
								>
									{LOG_CATEGORIES[step.index]?.label}
								</h4>
								<span className="text-muted-foreground text-xs tabular-nums">
									{categoryProgressLabel(step.index)}
								</span>
							</div>
							<LogRatingSlider
								// Remount per category so the zero-state "Rate" prompt returns.
								key={LOG_CATEGORIES[step.index]?.key}
								variant="compact"
								value={clampLogRatingDisplay(value)}
								onChange={(next) => {
									setValue(next);
									setTouched(true);
								}}
							/>
							<div className={actionsRowClassName}>
								<button
									type="button"
									className={PANEL_PRIMARY_PILL_CLASSNAME}
									disabled={saving}
									onClick={() => void handleNext(step.index)}
								>
									{touched ? "Next" : "Skip"}
								</button>
								<button
									type="button"
									className={PANEL_QUIET_PILL_CLASSNAME}
									disabled={saving}
									onClick={() => void handleNext(step.index, true)}
								>
									Done
								</button>
							</div>
						</>
					) : (
						<>
							<h4
								ref={finishedHeadingRef}
								id={headingId}
								tabIndex={-1}
								className="font-semibold text-base text-foreground outline-none"
							>
								{ratedCount > 0
									? `${ratedCount} ${ratedCount === 1 ? "category" : "categories"} rated`
									: "No categories rated"}
							</h4>
							{suggestion.kind !== "none" ? (
								<p className="text-pretty text-muted-foreground text-sm">
									{suggestion.kind === "offer"
										? `Suggested overall from your categories: ${formatLogRatingDisplay(suggestion.display)}`
										: `Your overall is ${formatLogRatingDisplay(overallDisplay ?? 0)}. Your categories suggest ${formatLogRatingDisplay(suggestion.display)}.`}
								</p>
							) : null}
							<div className={actionsRowClassName}>
								{suggestion.kind !== "none" ? (
									<button
										type="button"
										className={PANEL_PRIMARY_PILL_CLASSNAME}
										onClick={() => {
											onApplySuggestion(suggestion.display);
											handleClose();
										}}
									>
										{suggestion.kind === "offer"
											? `Use ${formatLogRatingDisplay(suggestion.display)}`
											: `Switch to ${formatLogRatingDisplay(suggestion.display)}`}
									</button>
								) : null}
								<button
									type="button"
									className={
										suggestion.kind === "none"
											? PANEL_PRIMARY_PILL_CLASSNAME
											: PANEL_QUIET_PILL_CLASSNAME
									}
									onClick={handleClose}
								>
									{suggestion.kind === "none" ? "Done" : "Keep as is"}
								</button>
							</div>
						</>
					)}
				</section>
			)}
		</div>
	);
}
