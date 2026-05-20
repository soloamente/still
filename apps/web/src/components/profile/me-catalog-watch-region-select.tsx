"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { meFieldControlClass } from "@/components/profile/me-form-field";
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

type RegionOption = { value: string; label: string };

/**
 * Mobbin-style watch-region control — same Base UI `Popover` + trigger rhythm as
 * `LogWatchedDatePicker` (movie quick-log), with a scrollable option list on `bg-background`.
 */
export function MeCatalogWatchRegionSelect({
	id,
	value,
	onChange,
}: {
	id: string;
	value: string;
	onChange: (next: string) => void;
}) {
	const [open, setOpen] = useState(false);

	const options = useMemo((): RegionOption[] => {
		return [
			{ value: "", label: "Not set yet (home will ask once)" },
			{ value: "ALL", label: "All countries" },
			...CATALOG_WATCH_REGION_OPTIONS.map(({ value: v, label }) => ({
				value: v,
				label,
			})),
		];
	}, []);

	const selectedLabel = useMemo(() => {
		const row = options.find((o) => o.value === value);
		return row?.label ?? "Not set yet (home will ask once)";
	}, [options, value]);

	const triggerClass = cn(
		meFieldControlClass(
			"flex w-full min-w-0 max-w-lg cursor-pointer items-center justify-between gap-2 text-left",
		),
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	);

	const optionRow = (active: boolean) =>
		cn(
			"flex w-full min-w-0 items-center rounded-xl px-3 py-2.5 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "bg-accent/15 text-foreground"
				: cn("text-foreground", DETAIL_CANVAS_ON_CARD_HOVER_CLASS),
		);

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				id={id}
				type="button"
				className={triggerClass}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
						open && "rotate-180",
					)}
					aria-hidden
				/>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="start"
				sideOffset={8}
				initialFocus={false}
				// Drop the default popup vertical scroll so wheel input targets the inner list, not
				// the shell (which was chaining scroll to the page). `overflow-visible` wins in merge.
				className="w-(--anchor-width) min-w-72 max-w-lg overflow-visible rounded-[1.75rem] p-2 shadow-mobbin-xl"
			>
				{/*
				 * Native overflow (not Base UI `ScrollArea`) keeps wheel / trackpad scrolling inside
				 * the popover. `overscroll-y-contain` stops scroll chaining to the document.
				 */}
				<div className="max-h-64 min-h-0 overflow-y-auto overscroll-y-contain rounded-2xl px-0.5 pt-1 pb-3">
					<div
						className="space-y-0.5 px-1"
						role="listbox"
						aria-label="Watch region"
					>
						{options.map((opt) => {
							const active = value === opt.value;
							return (
								<button
									key={opt.value === "" ? "__unset__" : opt.value}
									type="button"
									role="option"
									aria-selected={active}
									className={optionRow(active)}
									onClick={() => {
										onChange(opt.value);
										setOpen(false);
									}}
								>
									<span className="truncate">{opt.label}</span>
								</button>
							);
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
