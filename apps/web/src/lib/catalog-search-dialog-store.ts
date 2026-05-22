import { create } from "zustand";

/** Target panel width floor — wider than the pill so the open state feels roomy. */
export const CATALOG_SEARCH_PANEL_MIN_WIDTH_PX = 600;
/** Cap on large viewports so the sheet stays scannable. */
export const CATALOG_SEARCH_PANEL_MAX_WIDTH_PX = 800;
/** Edge inset when clamping the anchored panel to the viewport. */
export const CATALOG_SEARCH_VIEWPORT_GUTTER_PX = 12;
/** Grow width vs the trigger pill before floor / max / viewport clamps. */
export const CATALOG_SEARCH_PANEL_WIDTH_TRIGGER_MULTIPLIER = 1.48;

/** Keeps the panel horizontally centered on `centerX` while staying inside the viewport. */
export function clampCatalogSearchPanelLeftFromCenter(
	centerX: number,
	width: number,
): number {
	const vw = window.innerWidth;
	const half = width / 2;
	return Math.min(
		Math.max(CATALOG_SEARCH_VIEWPORT_GUTTER_PX, centerX - half),
		vw - width - CATALOG_SEARCH_VIEWPORT_GUTTER_PX,
	);
}

/** Computes fixed `top` / `left` / `width` / `maxHeight` for the dialog panel from the trigger rect. */
export function computeCatalogSearchAnchoredPanelStyle(trigger: DOMRect): {
	top: number;
	left: number;
	width: number;
	maxHeight: number;
} {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = Math.min(
		Math.max(
			Math.round(trigger.width * CATALOG_SEARCH_PANEL_WIDTH_TRIGGER_MULTIPLIER),
			CATALOG_SEARCH_PANEL_MIN_WIDTH_PX,
		),
		CATALOG_SEARCH_PANEL_MAX_WIDTH_PX,
		vw - CATALOG_SEARCH_VIEWPORT_GUTTER_PX * 2,
	);
	const centerX = trigger.left + trigger.width / 2;
	const left = clampCatalogSearchPanelLeftFromCenter(centerX, width);
	const maxHeight = Math.min(
		vh * 0.82,
		Math.max(280, vh - trigger.top - CATALOG_SEARCH_VIEWPORT_GUTTER_PX),
	);
	return { top: trigger.top, left, width, maxHeight };
}

/**
 * Synthetic anchor when opening from ⌘K on routes without the sticky pill — matches
 * the lobby pill width/position so the sheet animates from the same visual lane.
 */
export function defaultCatalogSearchShortcutAnchorRect(): DOMRect {
	const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
	const width = Math.min(
		Math.round(vw * 0.92),
		36 * 16,
		vw - CATALOG_SEARCH_VIEWPORT_GUTTER_PX * 2,
	);
	const height = 48;
	const left = (vw - width) / 2;
	const top = Math.max(CATALOG_SEARCH_VIEWPORT_GUTTER_PX + 72, 88);
	return new DOMRect(left, top, width, height);
}

type CatalogSearchShellUi = {
	/** Native `<dialog>` is open (includes exit animation). */
	dialogOpen: boolean;
	/** Panel is mounted and visible — drives pill “hand off” scale on `/home`. */
	showSheet: boolean;
};

type CatalogSearchDialogStore = {
	homeTriggerEl: HTMLButtonElement | null;
	navSearchTriggerEl: HTMLButtonElement | null;
	setHomeTriggerEl: (el: HTMLButtonElement | null) => void;
	setNavSearchTriggerEl: (el: HTMLButtonElement | null) => void;
	shellUi: CatalogSearchShellUi;
	setShellUi: (ui: CatalogSearchShellUi) => void;
	/** Set by `CatalogSearchDialogRoot` so opens are synchronous (no `useEffect` frame delay). */
	imperativelyOpen: ((anchor: DOMRect) => void) | null;
	registerImperativelyOpen: (fn: ((anchor: DOMRect) => void) | null) => void;
	openRequestId: number;
	pendingAnchor: DOMRect | null;
	/** Open the catalog search sheet; anchor prefers the sticky pill, then nav search, then shortcut fallback. */
	requestOpen: (anchorRect?: DOMRect | null) => void;
};

function resolveOpenAnchor(
	explicit: DOMRect | null | undefined,
	homeTriggerEl: HTMLButtonElement | null,
	navSearchTriggerEl: HTMLButtonElement | null,
): DOMRect {
	if (explicit) return explicit;
	const homeRect = homeTriggerEl?.getBoundingClientRect();
	if (homeRect && homeRect.width > 0 && homeRect.height > 0) {
		return homeRect;
	}
	const navRect = navSearchTriggerEl?.getBoundingClientRect();
	if (navRect && navRect.width > 0 && navRect.height > 0) {
		return navRect;
	}
	return defaultCatalogSearchShortcutAnchorRect();
}

export const useCatalogSearchDialog = create<CatalogSearchDialogStore>(
	(set, get) => ({
		homeTriggerEl: null,
		navSearchTriggerEl: null,
		setHomeTriggerEl: (el) => set({ homeTriggerEl: el }),
		setNavSearchTriggerEl: (el) => set({ navSearchTriggerEl: el }),
		shellUi: { dialogOpen: false, showSheet: false },
		setShellUi: (shellUi) => set({ shellUi }),
		imperativelyOpen: null,
		registerImperativelyOpen: (fn) => set({ imperativelyOpen: fn }),
		openRequestId: 0,
		pendingAnchor: null,
		requestOpen: (anchorRect) => {
			const { homeTriggerEl, navSearchTriggerEl, imperativelyOpen } = get();
			const anchor = resolveOpenAnchor(
				anchorRect,
				homeTriggerEl,
				navSearchTriggerEl,
			);
			if (imperativelyOpen) {
				imperativelyOpen(anchor);
				return;
			}
			set({
				pendingAnchor: anchor,
				openRequestId: get().openRequestId + 1,
			});
		},
	}),
);
