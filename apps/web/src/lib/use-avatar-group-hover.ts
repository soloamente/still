import { type RefObject, useCallback, useEffect } from "react";

/**
 * transitions.dev avatar-group-hover — distance-falloff lift on horizontal rows.
 * Attach `t-avatar-group` on the root and `t-avatar` on each child; call the
 * returned setter from each item's `onMouseEnter`.
 */
export function useAvatarGroupHover(rootRef: RefObject<HTMLElement | null>) {
	const setShifts = useCallback(
		(activeIdx: number | null, phase: "in" | "out") => {
			const root = rootRef.current;
			if (!root) return;

			const styles = getComputedStyle(root);
			const readNum = (name: string, fallback: number) => {
				const parsed = Number.parseFloat(styles.getPropertyValue(name).trim());
				return Number.isFinite(parsed) ? parsed : fallback;
			};
			const readEase = (name: string, fallback: string) =>
				styles.getPropertyValue(name).trim() || fallback;

			const lift = readNum("--avatar-lift", -4);
			const falloff = readNum("--avatar-falloff", 0.45);
			const scale = readNum("--avatar-scale", 1.05);
			const timing =
				phase === "out"
					? readEase("--avatar-ease-out", "cubic-bezier(0.34, 3.85, 0.64, 1)")
					: readEase("--avatar-ease-in", "cubic-bezier(0.22, 1, 0.36, 1)");

			root.querySelectorAll<HTMLElement>(".t-avatar").forEach((el, index) => {
				el.style.transitionTimingFunction = timing;
				if (activeIdx == null) {
					el.style.setProperty("--shift", "0px");
					el.style.setProperty("--scale-active", "1");
					return;
				}
				const distance = Math.abs(index - activeIdx);
				el.style.setProperty(
					"--shift",
					`${(lift * falloff ** distance).toFixed(3)}px`,
				);
				el.style.setProperty(
					"--scale-active",
					index === activeIdx ? String(scale) : "1",
				);
			});
		},
		[rootRef],
	);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onLeave = () => setShifts(null, "out");
		root.addEventListener("mouseleave", onLeave);
		return () => root.removeEventListener("mouseleave", onLeave);
	}, [rootRef, setShifts]);

	return setShifts;
}
