"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRef, useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { type PersonAwardRow, personAwardWorkHref } from "@/lib/person-awards";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Single award / nomination line — icon, label, year, status, credited work. */
function PersonAwardListRow({
	row,
	muted,
}: {
	row: PersonAwardRow;
	/** Nominations use muted ink for the whole row. */
	muted: boolean;
}) {
	const workHref = personAwardWorkHref(row);
	const statusWord = row.status === "won" ? "Won" : "Nominated";
	const workTitle = row.workTitle?.trim() || null;

	return (
		<li
			className={cn(
				"flex items-start gap-3 sm:gap-4",
				muted ? "text-muted-foreground" : "text-foreground",
			)}
		>
			{/* Compact festival mark so rows stay list-height, not grid-column wide. */}
			<div className="flex shrink-0 items-center justify-center pt-0.5">
				<FestivalRecognitionIcon
					icon={row.icon}
					className="h-8 w-22 sm:h-9 sm:w-24"
				/>
			</div>
			<div className="min-w-0 flex-1 space-y-0.5">
				<p
					className={cn(
						"text-pretty font-semibold text-sm leading-snug sm:text-[0.9375rem]",
						muted ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{row.awardLabel}
				</p>
				<p
					className={cn(
						"text-xs leading-relaxed sm:text-[0.8125rem]",
						muted ? "text-muted-foreground" : "text-foreground/80",
					)}
				>
					{row.year != null ? (
						<span className="font-medium tabular-nums">{row.year}</span>
					) : null}
					{row.year != null ? (
						<span aria-hidden className="px-1.5">
							·
						</span>
					) : null}
					<span>{statusWord}</span>
				</p>
				{workTitle ? (
					workHref ? (
						<Link
							href={workHref}
							className={cn(
								"block truncate text-sm underline-offset-4 transition-colors",
								"[@media(hover:hover)]:hover:underline",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								muted
									? "text-muted-foreground"
									: "text-foreground/90 [@media(hover:hover)]:hover:text-foreground",
							)}
						>
							{workTitle}
						</Link>
					) : (
						<span
							className={cn(
								"block truncate text-sm",
								muted ? "text-muted-foreground" : "text-foreground/90",
							)}
						>
							{workTitle}
						</span>
					)
				) : null}
			</div>
		</li>
	);
}

/**
 * Full person awards catalogue — opens from the About teaser when wins/noms
 * exceed the inline preview (or when only nominations exist).
 */
export function PersonAwardsDrawer({
	personName,
	rows,
	mutedTrigger = false,
}: {
	personName: string;
	rows: PersonAwardRow[];
	/** When true, trigger uses muted “View all awards” (noms-only teaser). */
	mutedTrigger?: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const contentKey = `${personName}:${rows.length}`;

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		contentKey,
	);

	const wins = rows.filter((row) => row.status === "won");
	const nominations = rows.filter((row) => row.status === "nominated");

	const summaryParts: string[] = [];
	if (wins.length > 0) {
		summaryParts.push(`${wins.length} win${wins.length === 1 ? "" : "s"}`);
	}
	if (nominations.length > 0) {
		summaryParts.push(
			`${nominations.length} nomination${nominations.length === 1 ? "" : "s"}`,
		);
	}

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={setOpen}
			scrollLock={false}
			title={`Awards — ${personName}`}
			description={`${rows.length} award and nomination rows for ${personName}.`}
			trigger={
				<DetailMotionButton
					type="button"
					className={cn(
						"inline-flex items-center justify-center rounded-full bg-background px-5 py-2.5 font-medium text-sm",
						"transition-colors duration-200 ease-out motion-reduce:transition-none",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						mutedTrigger ? "text-muted-foreground" : "text-foreground",
					)}
				>
					View all awards
				</DetailMotionButton>
			}
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-2xl px-2 pb-6 sm:px-4">
						{summaryParts.length > 0 ? (
							<p className="mx-auto mb-8 max-w-2xl text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
								{summaryParts.join(" · ")}
							</p>
						) : null}

						{/* Flat stacked rows — no decorative borders/rings; wins first. */}
						<div className="flex flex-col gap-10">
							{wins.length > 0 ? (
								<ul
									className="flex flex-col gap-6"
									aria-label={`Awards won by ${personName}`}
								>
									{wins.map((row) => (
										<PersonAwardListRow key={row.id} row={row} muted={false} />
									))}
								</ul>
							) : null}

							{nominations.length > 0 ? (
								<ul
									className="flex flex-col gap-6"
									aria-label={`Nominations for ${personName}`}
								>
									{nominations.map((row) => (
										<PersonAwardListRow key={row.id} row={row} muted />
									))}
								</ul>
							) : null}
						</div>
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
