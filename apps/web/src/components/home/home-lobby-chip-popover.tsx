"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { HOME_LOBBY_CHIP_BUTTON_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Compact mobile access when a full chip rail cannot share a row with sort/feed chips.
 * Desktop toolbars keep inline SegmentedPillToolbar rails (`sm+`).
 */
export function HomeLobbyChipPopover<T extends string>({
	"aria-label": ariaLabel,
	title,
	layoutId,
	value,
	options,
	onChange,
	triggerLabel,
}: {
	"aria-label": string;
	title: string;
	layoutId: string;
	value: T;
	options: readonly { id: T; label: string; title?: string }[];
	onChange: (next: T) => void;
	triggerLabel: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				type="button"
				className={cn(
					HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
					"gap-1.5 text-foreground",
				)}
				aria-label={`${ariaLabel} — ${triggerLabel}`}
				title={title}
			>
				<span>{triggerLabel}</span>
				<ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={10}
				initialFocus={false}
				className="w-auto overflow-visible rounded-[1.75rem] p-2 shadow-mobbin-xl"
			>
				<p className="sr-only">{title}</p>
				<SegmentedPillToolbar
					layoutId={layoutId}
					aria-label={ariaLabel}
					compact
					value={value}
					onChange={(next) => {
						onChange(next);
						setOpen(false);
					}}
					options={options}
				/>
			</PopoverContent>
		</Popover>
	);
}
