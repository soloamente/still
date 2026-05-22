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
import { CATALOG_TMDB_LANGUAGE_OPTIONS } from "@/lib/catalog-tmdb-language";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

type LanguageOption = { value: string; label: string };

/**
 * Catalogue language — TMDb copy for genres, titles, and search tag labels.
 * Empty value means “derive from watch region”.
 */
export function MeCatalogLanguageSelect({
	id,
	value,
	onChange,
}: {
	id: string;
	value: string;
	onChange: (next: string) => void;
}) {
	const [open, setOpen] = useState(false);

	const options = useMemo((): LanguageOption[] => {
		return [
			{ value: "", label: "Same as watch region" },
			...CATALOG_TMDB_LANGUAGE_OPTIONS.map(({ value: v, label }) => ({
				value: v,
				label,
			})),
		];
	}, []);

	const selectedLabel = useMemo(() => {
		const row = options.find((o) => o.value === value);
		return row?.label ?? "Same as watch region";
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
				align="start"
				className="w-[var(--radix-popover-trigger-width)] max-w-lg rounded-2xl border-0 bg-card p-2 shadow-lg"
			>
				<ul className="max-h-64 overflow-y-auto overscroll-contain">
					{options.map((option) => {
						const active = option.value === value;
						return (
							<li key={option.value || "default"}>
								<button
									type="button"
									role="option"
									aria-selected={active}
									className={optionRow(active)}
									onClick={() => {
										onChange(option.value);
										setOpen(false);
									}}
								>
									{option.label}
								</button>
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
