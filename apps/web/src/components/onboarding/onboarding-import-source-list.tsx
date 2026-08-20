"use client";

import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useEffect, useRef } from "react";

import {
	ONBOARDING_IMPORT_LIVE_SOURCES,
	ONBOARDING_IMPORT_SOON_SOURCES,
	ONBOARDING_IMPORT_SOURCE_LABEL,
	type OnboardingImportLiveSource,
	type OnboardingImportSoonSource,
	type OnboardingImportSourceId,
} from "@/lib/onboarding-import-queue";
import { useAvatarGroupHover } from "@/lib/use-avatar-group-hover";

/**
 * Right-pane import source picker — live Letterboxd/Anilist + Soon grid.
 * Desktop preview passes `fill` so the specimen centers mid-pane; mobile
 * stays in normal flow under the step copy.
 */

/** Raised tile on `bg-card` — opaque canvas fill only. */
const SOURCE_TILE_CLASSNAME =
	"flex w-full items-center gap-3 rounded-2xl bg-background px-4 text-left select-none sm:gap-4 sm:rounded-3xl sm:px-5";

const SOURCE_LOGO_SRC: Record<OnboardingImportSourceId, string> = {
	anilist: "/import-sources/anilist.png",
	letterboxd: "/import-sources/letterboxd.png",
	imdb: "/import-sources/imdb.png",
	trakt: "/import-sources/trakt.png",
	serializd: "/import-sources/serializd.png",
	tvtime: "/import-sources/tv_time.png",
};

const SOURCE_LOGO_FALLBACK_BG: Record<OnboardingImportSourceId, string> = {
	anilist: "bg-[#2B2D42]",
	letterboxd: "bg-[#14181C]",
	imdb: "bg-[#F5C518]",
	trakt: "bg-[#ED1C24]",
	serializd: "bg-[#0D0D0D]",
	tvtime: "bg-[#1A1A1A]",
};

type OnboardingImportSourceListProps = {
	selected: ReadonlySet<OnboardingImportLiveSource>;
	onToggleLive: (id: OnboardingImportLiveSource) => void;
	/**
	 * Desktop preview column: absolute fill + vertical center.
	 * Omit on mobile inline mount (normal flow under the step).
	 */
	fill?: boolean;
	className?: string;
};

function usePrefetchImportSourceLogos() {
	useEffect(() => {
		for (const src of Object.values(SOURCE_LOGO_SRC)) {
			const img = new window.Image();
			img.decoding = "async";
			img.src = src;
		}
	}, []);
}

function SourceMark({
	id,
	size = "md",
}: {
	id: OnboardingImportSourceId;
	size?: "sm" | "md";
}) {
	const box = size === "sm" ? "size-9 rounded-xl" : "size-11 rounded-2xl";
	return (
		<span
			aria-hidden
			className={cn(
				"relative shrink-0 overflow-hidden",
				box,
				SOURCE_LOGO_FALLBACK_BG[id],
			)}
		>
			{/* biome-ignore lint/performance/noImgElement: local brand marks; skip optimizer lag */}
			<img
				alt=""
				className="size-full object-cover"
				decoding="async"
				fetchPriority="high"
				height={size === "sm" ? 36 : 44}
				src={SOURCE_LOGO_SRC[id]}
				width={size === "sm" ? 36 : 44}
			/>
		</span>
	);
}

function SourceSelectMark({ selected }: { selected: boolean }) {
	return (
		<span
			aria-hidden
			className="t-icon-swap ml-auto size-6 shrink-0"
			data-state={selected ? "b" : "a"}
		>
			<span
				className="t-icon flex size-6 items-center justify-center rounded-full bg-foreground/12"
				data-icon="a"
			/>
			<span
				className="t-icon flex size-6 items-center justify-center rounded-full bg-foreground"
				data-icon="b"
			>
				<Check aria-hidden className="size-3.5 stroke-[2.5] text-background" />
			</span>
		</span>
	);
}

function handleSoonClick(event: MouseEvent<HTMLButtonElement>) {
	event.preventDefault();
}

function handleSoonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
	if (event.key === " " || event.key === "Enter") {
		event.preventDefault();
	}
}

function LiveSourceRow({
	id,
	selected,
	onToggleLive,
	index,
	onHoverEnter,
}: {
	id: OnboardingImportLiveSource;
	selected: boolean;
	onToggleLive: (id: OnboardingImportLiveSource) => void;
	index: number;
	onHoverEnter: (index: number) => void;
}) {
	const label = ONBOARDING_IMPORT_SOURCE_LABEL[id];

	return (
		// biome-ignore lint/a11y/useSemanticElements: brief requires button + role=checkbox
		<button
			aria-checked={selected}
			aria-label={label}
			className={cn("t-avatar", SOURCE_TILE_CLASSNAME, "cursor-pointer py-4")}
			onClick={() => onToggleLive(id)}
			onMouseEnter={() => onHoverEnter(index)}
			role="checkbox"
			type="button"
		>
			<SourceMark id={id} />
			<span className="min-w-0 flex-1">
				<span className="block font-medium text-[0.95rem] text-foreground leading-none">
					{label}
				</span>
				<span className="mt-1.5 block text-muted-foreground text-xs leading-none">
					{id === "letterboxd" ? "Films & diary CSV" : "Anime library JSON"}
				</span>
			</span>
			<SourceSelectMark selected={selected} />
		</button>
	);
}

/** Compact soon tile — 2-col grid keeps the specimen short enough to center. */
function SoonSourceRow({ id }: { id: OnboardingImportSoonSource }) {
	const label = ONBOARDING_IMPORT_SOURCE_LABEL[id];

	return (
		<button
			aria-disabled="true"
			aria-label={`${label}, soon`}
			className={cn(
				SOURCE_TILE_CLASSNAME,
				"cursor-default items-center py-3 opacity-55",
			)}
			onClick={handleSoonClick}
			onKeyDown={handleSoonKeyDown}
			type="button"
		>
			<SourceMark id={id} size="sm" />
			<span className="min-w-0 flex-1 truncate font-medium text-foreground/80 text-sm">
				{label}
			</span>
		</button>
	);
}

export function OnboardingImportSourceList({
	selected,
	onToggleLive,
	fill = false,
	className,
}: OnboardingImportSourceListProps) {
	usePrefetchImportSourceLogos();
	const liveGroupRef = useRef<HTMLDivElement>(null);
	const setLiveShifts = useAvatarGroupHover(liveGroupRef);

	return (
		// biome-ignore lint/a11y/useSemanticElements: brief requires role=group
		<div
			aria-label="Import sources"
			className={cn(
				"[--avatar-dur:280ms] [--avatar-lift:-3px] [--avatar-scale:1.02]",
				/*
				  Absolute fill — reliable pane height (flex % height collapses).
				  Scroll inside; center short stacks mid-pane.
				*/
				fill ? "absolute inset-0 overflow-y-auto overscroll-contain" : "w-full",
				className,
			)}
			role="group"
		>
			<div
				className={cn(
					"flex w-full justify-center",
					fill
						? "min-h-full items-center px-8 py-12 sm:px-12"
						: "items-start px-0 py-0",
				)}
			>
				<div className="mx-auto flex w-full max-w-sm flex-col gap-7">
					{fill ? (
						<div className="flex flex-col gap-1 px-1 text-center">
							<p className="font-medium text-foreground text-sm tracking-tight">
								Choose what to bring over
							</p>
							<p className="text-balance text-muted-foreground text-xs leading-relaxed">
								Letterboxd and Anilist are ready. More sources soon.
							</p>
						</div>
					) : null}

					<div className="flex flex-col gap-2.5">
						<p className="px-1 font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wider">
							Available now
						</p>
						<div
							ref={liveGroupRef}
							className="t-avatar-group flex flex-col gap-2"
						>
							{ONBOARDING_IMPORT_LIVE_SOURCES.map((id, index) => (
								<LiveSourceRow
									id={id}
									index={index}
									key={id}
									onHoverEnter={(i) => setLiveShifts(i, "in")}
									onToggleLive={onToggleLive}
									selected={selected.has(id)}
								/>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-2.5">
						<p className="px-1 font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wider">
							Coming later
						</p>
						{/* 2×2 grid — shorter block so the specimen stays visually centered. */}
						<div className="grid grid-cols-2 gap-2">
							{ONBOARDING_IMPORT_SOON_SOURCES.map((id) => (
								<SoonSourceRow id={id} key={id} />
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
