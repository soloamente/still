import { type RefObject, useCallback, useEffect } from "react";

export type AvatarGroupShiftPhase = "in" | "out";

export type AvatarGroupShiftTokens = {
	lift: number;
	falloff: number;
	scale: number;
	easeIn: string;
	easeOut: string;
};

/**
 * Distance-falloff lift used by transitions.dev avatar-group-hover.
 * Timing function is written inline *before* `--shift` / `--scale-active` so
 * hover-in uses ease-in and mouseleave uses the bouncy ease-out.
 */
export function applyAvatarGroupShifts(
	items: Iterable<HTMLElement>,
	activeIdx: number | null,
	phase: AvatarGroupShiftPhase,
	tokens: AvatarGroupShiftTokens,
): void {
	const timing = phase === "out" ? tokens.easeOut : tokens.easeIn;
	Array.from(items).forEach((el, index) => {
		el.style.transitionTimingFunction = timing;
		if (activeIdx == null) {
			el.style.setProperty("--shift", "0px");
			el.style.setProperty("--scale-active", "1");
			return;
		}
		const distance = Math.abs(index - activeIdx);
		el.style.setProperty(
			"--shift",
			`${(tokens.lift * tokens.falloff ** distance).toFixed(3)}px`,
		);
		el.style.setProperty(
			"--scale-active",
			index === activeIdx ? String(tokens.scale) : "1",
		);
	});
}

/** Items owned by this group — skip nested `.t-avatar-group` (e.g. rating sliders). */
export function ownedAvatarGroupItems(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(".t-avatar")).filter(
		(el) => el.closest(".t-avatar-group") === root,
	);
}

function readAvatarGroupTokens(root: HTMLElement): AvatarGroupShiftTokens {
	const styles = getComputedStyle(root);
	const readNum = (name: string, fallback: number) => {
		const parsed = Number.parseFloat(styles.getPropertyValue(name).trim());
		return Number.isFinite(parsed) ? parsed : fallback;
	};
	const readEase = (name: string, fallback: string) =>
		styles.getPropertyValue(name).trim() || fallback;

	return {
		lift: readNum("--avatar-lift", -4),
		falloff: readNum("--avatar-falloff", 0.45),
		scale: readNum("--avatar-scale", 1.05),
		easeIn: readEase("--avatar-ease-in", "cubic-bezier(0.22, 1, 0.36, 1)"),
		easeOut: readEase("--avatar-ease-out", "cubic-bezier(0.34, 3.85, 0.64, 1)"),
	};
}

function prefersHoverPointer(): boolean {
	return window.matchMedia("(hover: hover)").matches;
}

/**
 * transitions.dev avatar-group-hover — distance-falloff lift on horizontal rows.
 * Attach `t-avatar-group` on the root and `t-avatar` on each child; call the
 * returned setter from each item's `onMouseEnter`, or rely on delegated pointer/focus.
 */
export function useAvatarGroupHover(rootRef: RefObject<HTMLElement | null>) {
	const setShifts = useCallback(
		(activeIdx: number | null, phase: AvatarGroupShiftPhase) => {
			const root = rootRef.current;
			if (!root) return;
			applyAvatarGroupShifts(
				ownedAvatarGroupItems(root),
				activeIdx,
				phase,
				readAvatarGroupTokens(root),
			);
		},
		[rootRef],
	);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;

		const itemIndex = (target: EventTarget | null): number => {
			if (!(target instanceof Element)) return -1;
			const item = target.closest(".t-avatar");
			if (
				!(item instanceof HTMLElement) ||
				item.closest(".t-avatar-group") !== root
			) {
				return -1;
			}
			return ownedAvatarGroupItems(root).indexOf(item);
		};

		const onPointerOver = (event: PointerEvent) => {
			if (!prefersHoverPointer()) return;
			const related = event.relatedTarget;
			const fromItem =
				related instanceof Element ? related.closest(".t-avatar") : null;
			const toItem =
				event.target instanceof Element
					? event.target.closest(".t-avatar")
					: null;
			if (fromItem && fromItem === toItem) return;
			const index = itemIndex(event.target);
			if (index < 0) return;
			setShifts(index, "in");
		};

		const onFocusIn = (event: FocusEvent) => {
			const index = itemIndex(event.target);
			if (index < 0) return;
			setShifts(index, "in");
		};

		const onLeave = () => setShifts(null, "out");

		const onFocusOut = (event: FocusEvent) => {
			if (
				event.relatedTarget instanceof Node &&
				root.contains(event.relatedTarget)
			) {
				return;
			}
			setShifts(null, "out");
		};

		root.addEventListener("pointerover", onPointerOver);
		root.addEventListener("focusin", onFocusIn);
		root.addEventListener("mouseleave", onLeave);
		root.addEventListener("focusout", onFocusOut);
		return () => {
			root.removeEventListener("pointerover", onPointerOver);
			root.removeEventListener("focusin", onFocusIn);
			root.removeEventListener("mouseleave", onLeave);
			root.removeEventListener("focusout", onFocusOut);
		};
	}, [rootRef, setShifts]);

	return setShifts;
}
