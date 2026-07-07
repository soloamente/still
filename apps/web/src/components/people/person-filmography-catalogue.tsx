"use client";

import { useMemo, useState } from "react";

import { PersonFilmographyGrid } from "@/components/movie/person-filmography-grid";
import { SearchPillField } from "@/components/ui/search-pill-field";
import {
	filterPersonFilmographyRows,
	type PersonFilmographyRow,
} from "@/lib/person-filmography";

/**
 * Full-page filmography — local search over the patron's TMDb credit catalogue.
 * About bio/metadata stays on the About tab; this panel is grid-only.
 */
export function PersonFilmographyCatalogue({
	rows,
}: {
	rows: PersonFilmographyRow[];
}) {
	const [query, setQuery] = useState("");
	const filteredRows = useMemo(
		() => filterPersonFilmographyRows(rows, query),
		[rows, query],
	);
	const trimmedQuery = query.trim();

	return (
		<div className="mx-auto w-full max-w-7xl px-2.5 pt-3 pb-10 sm:px-3 sm:pt-8">
			<div className="mx-auto mb-6 flex justify-center sm:mb-8">
				<SearchPillField
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onClearQuery={() => setQuery("")}
					placeholder="Search filmography…"
					aria-label="Search filmography"
					autoComplete="off"
					spellCheck={false}
					containerClassName="border-0 bg-background shadow-none"
				/>
			</div>

			{rows.length === 0 ? (
				<p
					className="rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm"
					role="status"
				>
					No film credits loaded yet. Try again after the API syncs with TMDb.
				</p>
			) : filteredRows.length === 0 ? (
				<p
					className="rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm"
					role="status"
				>
					No titles match &ldquo;{trimmedQuery}&rdquo;.
				</p>
			) : (
				<PersonFilmographyGrid rows={filteredRows} />
			)}
		</div>
	);
}
