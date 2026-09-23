"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { WATCHLIST_PROVIDER_PILL_SLOT_ID } from "@/components/watchlist/watchlist-lobby-filter-row";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import {
	resolveWatchlistProviderEntry,
	useWatchlistProvidersCatalog,
} from "@/components/watchlist/watchlist-providers-catalog-context";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

const TMDB_PROVIDER_LOGO = (path: string) =>
	`https://image.tmdb.org/t/p/w92${path}`;

const MAX_STACKED_LOGOS = 4;

const managePillClassName = cn(
	"inline-flex min-h-10 max-w-[min(14rem,42vw)] items-center gap-2 rounded-full bg-background py-1.5 pr-3 pl-1.5 text-left transition-[transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

const panelActionClassName = cn(
	"inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-card px-3 font-medium text-foreground text-sm transition-[transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

/**
 * Composite AND-filter pill — portals into the filter row slot beside the filters icon.
 * Task 8 adds shared `layoutId` morph from platform cards; v1 is static appear/disappear.
 */
export function WatchlistProviderFilterPill() {
	const { providers, removeProvider, clearProviders } =
		useWatchlistLobbyParams();
	const { providers: catalogue } = useWatchlistProvidersCatalog();
	const [slot, setSlot] = useState<HTMLElement | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setSlot(document.getElementById(WATCHLIST_PROVIDER_PILL_SLOT_ID));
	}, []);

	const selectedEntries = useMemo(
		() => providers.map((id) => resolveWatchlistProviderEntry(catalogue, id)),
		[catalogue, providers],
	);

	const label = useMemo(() => {
		if (selectedEntries.length === 0) return "";
		if (selectedEntries.length === 1) {
			return `Streaming filter: ${selectedEntries[0]?.providerName ?? "service"}`;
		}
		const names = selectedEntries
			.map((entry) => entry.providerName)
			.join(" and ");
		return `Streaming filter: ${names}`;
	}, [selectedEntries]);

	if (providers.length === 0 || slot == null) return null;

	const pill = (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				type="button"
				className={managePillClassName}
				aria-label={label}
				title={label}
			>
				<span className="flex shrink-0 items-center pl-0.5">
					{selectedEntries.slice(0, MAX_STACKED_LOGOS).map((entry, index) => (
						<span
							key={entry.providerId}
							className={cn(
								"relative inline-flex size-7 overflow-hidden rounded-full bg-card ring-2 ring-background",
								index > 0 && "-ml-2",
							)}
							style={{ zIndex: MAX_STACKED_LOGOS - index }}
						>
							{entry.logoPath ? (
								<Image
									src={TMDB_PROVIDER_LOGO(entry.logoPath)}
									alt=""
									width={28}
									height={28}
									className="size-full object-contain p-0.5"
									unoptimized
								/>
							) : (
								<span className="flex size-full items-center justify-center font-medium text-[10px] text-foreground">
									{entry.providerName.slice(0, 1)}
								</span>
							)}
						</span>
					))}
					{selectedEntries.length > MAX_STACKED_LOGOS ? (
						<span className="relative -ml-2 inline-flex size-7 items-center justify-center rounded-full bg-card font-medium text-[10px] text-foreground ring-2 ring-background">
							+{selectedEntries.length - MAX_STACKED_LOGOS}
						</span>
					) : null}
				</span>
				<span className="min-w-0 truncate font-medium text-foreground text-sm">
					{selectedEntries.map((entry) => entry.providerName).join(" · ")}
				</span>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={12}
				initialFocus={false}
				className="w-[min(100vw-1.5rem,20rem)] overflow-visible rounded-[1.75rem] p-3 shadow-mobbin-xl"
			>
				<div className="flex min-h-0 flex-col gap-3">
					<div className="px-0.5">
						<p className="font-semibold text-base text-foreground leading-snug">
							Streaming filter
						</p>
						<p className="mt-0.5 text-pretty text-muted-foreground text-sm leading-snug">
							Titles must stream on every selected service in your region.
						</p>
					</div>
					<ul className="flex flex-col gap-1">
						{selectedEntries.map((entry) => (
							<li
								key={entry.providerId}
								className="flex items-center gap-2 rounded-2xl bg-background px-2 py-2"
							>
								<span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card">
									{entry.logoPath ? (
										<Image
											src={TMDB_PROVIDER_LOGO(entry.logoPath)}
											alt=""
											width={36}
											height={36}
											className="size-8 object-contain"
											unoptimized
										/>
									) : (
										<span className="font-medium text-foreground text-xs">
											{entry.providerName.slice(0, 2)}
										</span>
									)}
								</span>
								<span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
									{entry.providerName}
								</span>
								<button
									type="button"
									className={panelActionClassName}
									onClick={() => {
										removeProvider(entry.providerId);
										if (providers.length <= 1) setOpen(false);
									}}
								>
									Remove
								</button>
							</li>
						))}
					</ul>
					<div className="flex justify-end px-0.5">
						<button
							type="button"
							className={panelActionClassName}
							onClick={() => {
								clearProviders();
								setOpen(false);
							}}
						>
							Clear all
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);

	return createPortal(pill, slot);
}
