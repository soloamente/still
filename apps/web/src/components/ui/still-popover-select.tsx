"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

export type StillPopoverSelectOption = {
	value: string;
	label: string;
};

/**
 * Quick Log / sheet field select — `bg-background` trigger and menu on `bg-card`
 * dialogs; neutral selected row (`bg-foreground/10`), no accent tint.
 */
export function StillPopoverSelect({
	id,
	value,
	onChange,
	options,
	placeholder,
	disabled = false,
	listAriaLabel,
	popoverPositionerClassName,
	popoverSide = "top",
}: {
	id: string;
	value: string;
	onChange: (next: string) => void;
	options: StillPopoverSelectOption[];
	placeholder: string;
	disabled?: boolean;
	listAriaLabel: string;
	/** Raise above portaled modals (`APP_MODAL_POPOVER_POSITIONER_CLASS`). */
	popoverPositionerClassName?: string;
	popoverSide?: "top" | "bottom" | "left" | "right";
}) {
	const [open, setOpen] = useState(false);

	const selectedLabel = useMemo(() => {
		const row = options.find((o) => o.value === value);
		return row?.label;
	}, [options, value]);

	const triggerClass = cn(
		"flex h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-2xl border-0 border-transparent bg-background px-3.5 text-left text-base text-foreground shadow-none outline-none ring-0 transition-colors duration-200 ease-out motion-reduce:transition-none",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		"focus-visible:border-0 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-0",
		disabled && "pointer-events-none opacity-50",
	);

	const optionRow = (active: boolean) =>
		cn(
			"flex w-full min-w-0 items-center rounded-xl px-3 py-2.5 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "bg-foreground/10 text-foreground"
				: cn("text-foreground", DETAIL_CANVAS_ON_CARD_HOVER_CLASS),
		);

	return (
		// Lock row height so open state on the portaled menu never reflows siblings.
		<div className="relative min-h-11 w-full">
			<Popover open={open} onOpenChange={setOpen} modal={false}>
				<PopoverTrigger
					id={id}
					type="button"
					disabled={disabled}
					className={triggerClass}
					aria-haspopup="listbox"
					aria-expanded={open}
				>
					<span
						className={cn(
							"min-w-0 flex-1 truncate",
							!selectedLabel && "text-muted-foreground",
						)}
					>
						{selectedLabel ?? placeholder}
					</span>
					<ChevronDown
						className={cn(
							"size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
							open && "rotate-180",
						)}
						aria-hidden
					/>
				</PopoverTrigger>
				<PopoverContent
					side={popoverSide}
					align="start"
					sideOffset={8}
					positionMethod="fixed"
					positionerClassName={popoverPositionerClassName}
					initialFocus={false}
					className="w-(--anchor-width) max-w-lg rounded-[1.75rem] border-0 bg-background p-2 shadow-mobbin-xl"
				>
					<div className="max-h-64 min-h-0 overflow-y-auto overscroll-y-contain rounded-2xl px-0.5 pt-1 pb-3">
						<div
							className="space-y-0.5 px-1"
							role="listbox"
							aria-label={listAriaLabel}
						>
							{options.map((option) => {
								const active = option.value === value;
								return (
									<button
										key={option.value}
										type="button"
										role="option"
										aria-selected={active}
										className={optionRow(active)}
										onClick={() => {
											onChange(option.value);
											setOpen(false);
										}}
									>
										<span className="truncate">{option.label}</span>
									</button>
								);
							})}
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
