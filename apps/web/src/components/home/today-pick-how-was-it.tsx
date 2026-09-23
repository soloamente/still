"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { LogCategoryRatingsPanel } from "@/components/log/log-category-ratings-panel";
import { LogRatingSlider } from "@/components/log/log-rating-slider";
import { clampLogRatingDisplay, logRatingToStored } from "@/lib/log-rating";
import { patchLog } from "@/lib/still-api-fetch";
import { dispatchTodayWeekRefresh } from "@/lib/today-week-pulse";

/**
 * Inline post-watch rating for the Today pick — the diary log already exists,
 * so Save only PATCHes the overall score and Skip leaves the log untouched.
 */
export function TodayPickHowWasIt({
	logId,
	averageRating,
	onSettled,
}: {
	logId: string;
	/** Community average on 0–10 display — static band inside the slider track. */
	averageRating?: number | null;
	onSettled: () => void;
}) {
	// Start at 0 so the compact slider shows its "Rate" zero state, not a fake score.
	const [ratingDisplay, setRatingDisplay] = useState(0);
	const [touched, setTouched] = useState(false);
	const [saving, setSaving] = useState(false);

	async function handleSave() {
		if (!touched || saving) return;
		setSaving(true);
		try {
			const result = await patchLog(logId, {
				rating: logRatingToStored(ratingDisplay),
			});
			if (!result.ok) throw new Error("rating patch failed");
			// "N rated" on the week card moves with this.
			dispatchTodayWeekRefresh();
			onSettled();
		} catch (err) {
			console.error("[today] rating save failed", err);
			toast.error("Couldn't save your rating");
			setSaving(false);
		}
	}

	return (
		<fieldset className="m-0 flex w-full min-w-0 max-w-sm flex-col gap-2 rounded-3xl border-0 bg-background/70 p-4 backdrop-blur-sm">
			{/* `float-left w-full` pulls the legend into normal flow inside the rounded tile. */}
			<legend className="float-left w-full p-0 font-medium text-foreground text-sm">
				How was it?
			</legend>
			<LogRatingSlider
				variant="compact"
				value={clampLogRatingDisplay(ratingDisplay)}
				onChange={(next) => {
					setRatingDisplay(next);
					setTouched(true);
				}}
				averageRating={averageRating}
			/>
			<div className="flex items-center justify-center gap-2 pt-1 sm:justify-start">
				<button
					type="button"
					className={cn(
						"inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-4 font-medium text-background text-sm transition-[transform,opacity] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
						"disabled:pointer-events-none disabled:opacity-50",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
					disabled={!touched || saving}
					onClick={() => void handleSave()}
				>
					Save rating
				</button>
				<button
					type="button"
					className={cn(
						"inline-flex min-h-10 items-center justify-center rounded-full px-4 font-medium text-foreground/80 text-sm transition-[transform,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
					disabled={saving}
					onClick={onSettled}
				>
					Skip
				</button>
			</div>
			<LogCategoryRatingsPanel
				logId={logId}
				overallDisplay={touched ? ratingDisplay : null}
				// Fill the overall slider; the patron still confirms with Save rating.
				onApplySuggestion={(display) => {
					setRatingDisplay(display);
					setTouched(true);
				}}
			/>
		</fieldset>
	);
}
