"use client";

import { Button } from "@still/ui/components/button";
import { LayoutGrid, LayoutList } from "lucide-react";
import { useEffect, useState } from "react";
import { DiaryEntry, type DiaryLogRow } from "@/components/diary/diary-entry";
import { DiaryStillTile } from "@/components/diary/diary-still-tile";

/** Persists the user’s diary density preference across visits. */
const LAYOUT_STORAGE_KEY = "still.diary.layout" as const;

export type DiarySection = {
	key: string;
	monthLabel: string;
	year: string;
	rows: DiaryLogRow[];
};

type DiaryLayout = "list" | "masonry";

export function DiaryPageClient({ sections }: { sections: DiarySection[] }) {
	const [layout, setLayout] = useState<DiaryLayout>("list");

	// Hydrate from localStorage after mount so SSR HTML matches the default list view.
	useEffect(() => {
		try {
			const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
			if (raw === "masonry" || raw === "list") setLayout(raw);
		} catch {
			/* private / blocked storage — keep default */
		}
	}, []);

	function persistLayout(next: DiaryLayout) {
		setLayout(next);
		try {
			window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
		} catch {
			/* ignore */
		}
	}

	return (
		<div className="space-y-8">
			<div
				className="flex flex-wrap items-center justify-end gap-2"
				role="toolbar"
				aria-label="Diary layout"
			>
				<span className="mr-auto text-muted-foreground text-xs uppercase tracking-wider">
					View
				</span>
				<Button
					type="button"
					variant={layout === "list" ? "accent" : "ghost-light"}
					size="pill"
					className="gap-1.5"
					aria-pressed={layout === "list"}
					onClick={() => persistLayout("list")}
				>
					<LayoutList className="size-3.5" aria-hidden />
					Tickets
				</Button>
				<Button
					type="button"
					variant={layout === "masonry" ? "accent" : "ghost-light"}
					size="pill"
					className="gap-1.5"
					aria-pressed={layout === "masonry"}
					onClick={() => persistLayout("masonry")}
				>
					<LayoutGrid className="size-3.5" aria-hidden />
					Stills
				</Button>
			</div>

			{sections.map((section) => (
				<div
					key={section.key}
					className="cinema-film-strip-rail cinema-film-strip-rail--coded space-y-3"
					data-edge-code={
						section.year
							? `KODAK · 5219 · ${section.monthLabel.slice(0, 3).toUpperCase()} ${section.year}`
							: "KODAK · 5219 · UNDATED"
					}
					data-edge-layout="vertical"
				>
					<h3 className="font-display text-muted-foreground text-xl tracking-[-0.01em]">
						{section.year ? (
							<>
								{section.monthLabel} {section.year}
							</>
						) : (
							section.monthLabel
						)}
					</h3>

					{layout === "list" ? (
						<ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
							{section.rows.map((row) => (
								<li key={row.log.id}>
									<DiaryEntry row={row} />
								</li>
							))}
						</ul>
					) : (
						/* CSS columns give a masonry-like still wall without JS measurement libraries. */
						<ul className="columns-2 gap-x-3 sm:columns-3 md:columns-4 lg:columns-5 [&>li]:mb-3 [&>li]:break-inside-avoid">
							{section.rows.map((row) => (
								<li key={row.log.id}>
									<DiaryStillTile row={row} />
								</li>
							))}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}
