import type { SearchDialogResultArrow } from "@/lib/search-dialog-result-keyboard";

/** One keyboard-navigable block in empty ⌘K browse (stacked top → bottom). */
export type SearchDialogEmptyBrowseSection =
	| { kind: "rail"; count: number }
	| { kind: "list"; count: number };

export function searchDialogEmptyBrowseTotalCount(
	sections: readonly SearchDialogEmptyBrowseSection[],
): number {
	return sections.reduce((sum, section) => sum + Math.max(0, section.count), 0);
}

function resolveSectionLocal(
	sections: readonly SearchDialogEmptyBrowseSection[],
	globalIndex: number,
): { sectionIndex: number; localIndex: number } | null {
	let cursor = 0;
	for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
		const section = sections[sectionIndex];
		if (section.count <= 0) continue;
		if (globalIndex < cursor + section.count) {
			return { sectionIndex, localIndex: globalIndex - cursor };
		}
		cursor += section.count;
	}
	return null;
}

function globalIndexFromLocal(
	sections: readonly SearchDialogEmptyBrowseSection[],
	sectionIndex: number,
	localIndex: number,
): number {
	let cursor = 0;
	for (let i = 0; i < sections.length; i++) {
		const section = sections[i];
		if (section.count <= 0) continue;
		if (i === sectionIndex) {
			return cursor + localIndex;
		}
		cursor += section.count;
	}
	return 0;
}

function nextNonEmptySectionIndex(
	sections: readonly SearchDialogEmptyBrowseSection[],
	from: number,
	direction: -1 | 1,
): number | null {
	let i = from + direction;
	while (i >= 0 && i < sections.length) {
		if (sections[i].count > 0) return i;
		i += direction;
	}
	return null;
}

/** Arrow keys across stacked rails + list rows in empty browse. */
export function moveSearchDialogEmptyBrowseFocus(
	focusedIndex: number | null,
	sections: readonly SearchDialogEmptyBrowseSection[],
	direction: SearchDialogResultArrow,
): number {
	const total = searchDialogEmptyBrowseTotalCount(sections);
	if (total <= 0) return 0;
	if (focusedIndex == null) {
		return direction === "up" ? total - 1 : 0;
	}

	const resolved = resolveSectionLocal(sections, focusedIndex);
	if (!resolved) return 0;

	const section = sections[resolved.sectionIndex];
	if (section.count <= 0) return 0;

	switch (direction) {
		case "left":
			if (section.kind === "rail" && resolved.localIndex > 0) {
				return globalIndexFromLocal(
					sections,
					resolved.sectionIndex,
					resolved.localIndex - 1,
				);
			}
			return focusedIndex;
		case "right":
			if (section.kind === "rail" && resolved.localIndex < section.count - 1) {
				return globalIndexFromLocal(
					sections,
					resolved.sectionIndex,
					resolved.localIndex + 1,
				);
			}
			return focusedIndex;
		case "down": {
			if (section.kind === "list" && resolved.localIndex < section.count - 1) {
				return focusedIndex + 1;
			}
			const nextSection = nextNonEmptySectionIndex(
				sections,
				resolved.sectionIndex,
				1,
			);
			if (nextSection == null) return focusedIndex;
			return globalIndexFromLocal(sections, nextSection, 0);
		}
		case "up": {
			if (section.kind === "list" && resolved.localIndex > 0) {
				return focusedIndex - 1;
			}
			const prevSection = nextNonEmptySectionIndex(
				sections,
				resolved.sectionIndex,
				-1,
			);
			if (prevSection == null) return focusedIndex;
			const prev = sections[prevSection];
			const local = Math.min(resolved.localIndex, prev.count - 1);
			return globalIndexFromLocal(sections, prevSection, local);
		}
		default: {
			const _exhaustive: never = direction;
			return _exhaustive;
		}
	}
}
