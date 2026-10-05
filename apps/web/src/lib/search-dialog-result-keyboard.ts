import { useEffect, useState } from "react";

/** Matches {@link SEARCH_DIALOG_POSTER_GRID_CLASS} breakpoints. */
export function searchDialogPosterGridColumnCount(
	viewportWidth: number,
): number {
	if (viewportWidth >= 704) return 5;
	if (viewportWidth >= 640) return 4;
	return 3;
}

export type SearchDialogResultArrow = "up" | "down" | "left" | "right";

/** First arrow from the query field lands on row 0 (or last row on ↑). */
export type SearchDialogResultKeyboardLayout = "grid" | "list" | "rail";

export function moveSearchDialogResultFocus(
	focusedIndex: number | null,
	count: number,
	direction: SearchDialogResultArrow,
	columns: number,
	layout: SearchDialogResultKeyboardLayout,
): number {
	if (count <= 0) return 0;
	if (focusedIndex == null) {
		return direction === "up" ? count - 1 : 0;
	}
	return moveSearchDialogResultIndex(
		focusedIndex,
		count,
		direction,
		columns,
		layout,
	);
}

export function moveSearchDialogResultIndex(
	current: number,
	count: number,
	direction: SearchDialogResultArrow,
	columns: number,
	layout: SearchDialogResultKeyboardLayout,
): number {
	if (count <= 0) return 0;

	if (layout === "rail") {
		if (direction === "left" || direction === "up") {
			return Math.max(0, current - 1);
		}
		if (direction === "right" || direction === "down") {
			return Math.min(count - 1, current + 1);
		}
		return current;
	}

	if (layout === "list") {
		if (direction === "down" || direction === "right") {
			return Math.min(count - 1, current + 1);
		}
		if (direction === "up" || direction === "left") {
			return Math.max(0, current - 1);
		}
		return current;
	}

	const row = Math.floor(current / columns);
	const col = current % columns;

	switch (direction) {
		case "left":
			return col > 0 ? current - 1 : current;
		case "right":
			return col < columns - 1 && current + 1 < count ? current + 1 : current;
		case "up":
			return row > 0 ? current - columns : current;
		case "down":
			return current + columns < count ? current + columns : current;
		default: {
			const _exhaustive: never = direction;
			return _exhaustive;
		}
	}
}

export function searchDialogResultArrowFromKey(
	key: string,
): SearchDialogResultArrow | null {
	switch (key) {
		case "ArrowUp":
			return "up";
		case "ArrowDown":
			return "down";
		case "ArrowLeft":
			return "left";
		case "ArrowRight":
			return "right";
		default:
			return null;
	}
}

/** Live column count for poster-grid arrow math. */
export function useSearchDialogPosterGridColumnCount(): number {
	const [columns, setColumns] = useState(3);

	useEffect(() => {
		const sync = () => {
			setColumns(searchDialogPosterGridColumnCount(window.innerWidth));
		};
		sync();
		window.addEventListener("resize", sync);
		return () => window.removeEventListener("resize", sync);
	}, []);

	return columns;
}
