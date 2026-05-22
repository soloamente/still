"use client";

import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	motion,
	type Transition,
	useReducedMotion,
} from "motion/react";
import {
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

import IconXmarkFill12 from "../icons/xmark-fill-12";

export interface RadialToolkitItem {
	id: string;
	label: string;
	/** Single-letter accelerator (shown in the pill; also works if toolkit stays open). */
	shortcut?: string;
	icon: ReactNode;
	variant?: "default" | "destructive";
	disabled?: boolean;
	onSelect: () => void;
}

const ORBIT_RADIUS_PX = 96;
const HUB_RADIUS_PX = 28;
const ICON_CELL_PX = 48;
/** Stroke-only orbit ring diameter (12.5rem — unchanged from reference layout). */
const ORBIT_RING_PX = 200;
const TRACK_SIZE_PX = ORBIT_RADIUS_PX * 2 + ICON_CELL_PX;
const TRACK_CENTER = TRACK_SIZE_PX / 2;
/** Clear gap from icon rim to the tooltip edge that faces the icon. */
const LABEL_RIM_GAP_PX = 20;

/** Figma reference accent — wedge, hub ring, active pill (default actions). */
const ACTION_BLUE = "#38bdf8";
/** Delete slot only — matches `--color-crimson-blush` / destructive token. */
const ACTION_DESTRUCTIVE = "#df6a6b";

function wedgeGradientStops(accent: string) {
	return (
		<>
			<stop offset="0%" stopColor={accent} stopOpacity={0} />
			<stop
				offset={`${(HUB_RADIUS_PX / (ORBIT_RADIUS_PX + 14)) * 100}%`}
				stopColor={accent}
				stopOpacity={0}
			/>
			<stop offset="68%" stopColor={accent} stopOpacity={0.22} />
			<stop offset="88%" stopColor={accent} stopOpacity={0.6} />
			<stop offset="100%" stopColor={accent} stopOpacity={0.8} />
		</>
	);
}

/** Inside this radius from the hub, no wedge or action is selected. */
const HUB_DEAD_ZONE_PX = ORBIT_RADIUS_PX * 0.55;

/** Block the browser context menu briefly after RMB release (fires after toolkit unmounts). */
const NATIVE_CONTEXT_MENU_SUPPRESS_MS = 500;
let suppressNativeContextMenuUntil = 0;

function armNativeContextMenuSuppression() {
	suppressNativeContextMenuUntil =
		(typeof performance !== "undefined" ? performance.now() : Date.now()) +
		NATIVE_CONTEXT_MENU_SUPPRESS_MS;
}

function shouldSuppressNativeContextMenu() {
	const now =
		typeof performance !== "undefined" ? performance.now() : Date.now();
	return now < suppressNativeContextMenuUntil;
}

/** Sentinel: pointer is over the hub — nothing highlighted. */
const NO_SELECTION = -1;

/** Motion Codex smooth-tabs spring — physics, no overshoot, interruptible. */
const SPRING_AIM: Transition = {
	type: "spring",
	stiffness: 500,
	damping: 35,
};

/** Icon selection ring — opacity springs in fast; border color follows aim. */
const SPRING_ICON_RING: Transition = {
	opacity: { type: "spring", stiffness: 700, damping: 40 },
	scale: SPRING_AIM,
	borderColor: SPRING_AIM,
};

const SPRING_ENTER: Transition = {
	type: "spring",
	duration: 0.34,
	bounce: 0,
};

const SPRING_EXIT: Transition = {
	type: "spring",
	duration: 0.2,
	bounce: 0,
};

const fadeUpHidden = { opacity: 0, scale: 0.86, y: 8, filter: "blur(6px)" };
const fadeUpVisible = { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" };
const fadeUpExit = { opacity: 0, scale: 0.96, y: 4, filter: "blur(3px)" };

const menuShellVariants = {
	hidden: { opacity: 0, scale: 0.92 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			staggerChildren: 0.045,
			delayChildren: 0.04,
		},
	},
};

const pieceVariants = {
	hidden: fadeUpHidden,
	visible: fadeUpVisible,
};

/** Rotate the wedge along the shortest arc when jumping between segments. */
function shortestRotateTarget(previous: number, next: number) {
	let delta = next - (previous % 360);
	if (delta > 180) delta -= 360;
	if (delta < -180) delta += 360;
	return previous + delta;
}

function clampAnchor(x: number, y: number) {
	const pad = 24;
	const half = TRACK_SIZE_PX / 2;
	const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
	const vh = typeof window !== "undefined" ? window.innerHeight : 800;
	return {
		x: Math.min(Math.max(x, pad + half), vw - pad - half),
		y: Math.min(Math.max(y, pad + half), vh - pad - half),
	};
}

/** Screen-space polar offset; 0° = top, clockwise positive. */
function polarToXY(radius: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return {
		x: TRACK_CENTER + radius * Math.cos(rad),
		y: TRACK_CENTER + radius * Math.sin(rad),
	};
}

/** Pointer angle from hub: 0° = top, clockwise. */
function pointerAngleDeg(
	centerX: number,
	centerY: number,
	clientX: number,
	clientY: number,
) {
	const rad = Math.atan2(clientX - centerX, -(clientY - centerY));
	let deg = (rad * 180) / Math.PI;
	if (deg < 0) deg += 360;
	return deg;
}

function segmentIndex(deg: number, count: number, stepDeg: number) {
	return Math.floor((deg + stepDeg / 2) / stepDeg) % count;
}

/** Wedge pointing up (0°); parent rotates to the active segment. */
function wedgePathUp(sweepDeg: number, innerR: number, outerR: number) {
	return wedgePath(0, sweepDeg, innerR, outerR);
}

/** SVG pie slice centered on `centerDeg` (0° = top). */
function wedgePath(
	centerDeg: number,
	sweepDeg: number,
	innerR: number,
	outerR: number,
) {
	const start = centerDeg - sweepDeg / 2;
	const end = centerDeg + sweepDeg / 2;
	const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
	const largeArc = sweepDeg > 180 ? 1 : 0;

	const ix0 = TRACK_CENTER + innerR * Math.cos(toRad(start));
	const iy0 = TRACK_CENTER + innerR * Math.sin(toRad(start));
	const ox0 = TRACK_CENTER + outerR * Math.cos(toRad(start));
	const oy0 = TRACK_CENTER + outerR * Math.sin(toRad(start));
	const ox1 = TRACK_CENTER + outerR * Math.cos(toRad(end));
	const oy1 = TRACK_CENTER + outerR * Math.sin(toRad(end));
	const ix1 = TRACK_CENTER + innerR * Math.cos(toRad(end));
	const iy1 = TRACK_CENTER + innerR * Math.sin(toRad(end));

	return [
		`M ${ix0} ${iy0}`,
		`L ${ox0} ${oy0}`,
		`A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox1} ${oy1}`,
		`L ${ix1} ${iy1}`,
		`A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix0} ${iy0}`,
		"Z",
	].join(" ");
}

/**
 * Anchor the tooltip edge nearest the icon on a fixed rim gap; pill grows outward.
 * Centering on the radial caused side pills to overlap the 48px icon tiles.
 */
function activeLabelAnchor(angleDeg: number) {
	const anchorR = ORBIT_RADIUS_PX + ICON_CELL_PX / 2 + LABEL_RIM_GAP_PX;
	const pos = polarToXY(anchorR, angleDeg);
	const norm = ((angleDeg % 360) + 360) % 360;

	if (norm >= 315 || norm < 45) {
		return { pos, motion: { x: "-50%", y: "-100%" } as const };
	}
	if (norm >= 45 && norm < 135) {
		return { pos, motion: { x: "0%", y: "-50%" } as const };
	}
	if (norm >= 135 && norm < 225) {
		return { pos, motion: { x: "-50%", y: "0%" } as const };
	}
	return { pos, motion: { x: "-100%", y: "-50%" } as const };
}

/**
 * Hold right-click and drag to aim; release to confirm the highlighted action.
 * Attach `triggerProps` to the surface (e.g. poster tile).
 */
export function useRadialToolkitAnchor() {
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const draggingRef = useRef(false);

	const onOpenChange = useCallback((next: boolean) => {
		setOpen(next);
		if (!next) {
			setAnchor(null);
			draggingRef.current = false;
		}
	}, []);

	const onContextMenu = useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
	}, []);

	const onPointerDown = useCallback((event: ReactPointerEvent) => {
		if (event.button !== 2) return;
		event.preventDefault();
		event.stopPropagation();
		draggingRef.current = true;
		setAnchor({ x: event.clientX, y: event.clientY });
		setOpen(true);
	}, []);

	return {
		open,
		anchor,
		onOpenChange,
		onContextMenu,
		onPointerDown,
	};
}

export function RadialToolkit({
	open,
	onOpenChange,
	anchor,
	items,
	title = "Actions",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	anchor: { x: number; y: number } | null;
	items: RadialToolkitItem[];
	title?: string;
}) {
	const reduceMotion = useReducedMotion();
	const menuId = useId();
	const [activeIndex, setActiveIndex] = useState(NO_SELECTION);
	const activeIndexRef = useRef(NO_SELECTION);
	const prevActiveIndexRef = useRef(NO_SELECTION);
	const [wedgeRotate, setWedgeRotate] = useState(0);
	const wedgeRotateRef = useRef(0);
	const [mounted, setMounted] = useState(false);

	const clampedAnchor = useMemo(() => {
		if (!anchor) return null;
		return clampAnchor(anchor.x, anchor.y);
	}, [anchor]);

	const count = items.length;
	const sessionRef = useRef(false);
	const stepDeg = count > 0 ? 360 / count : 360;
	const wedgeOuterR = ORBIT_RADIUS_PX + 14;
	const wedgePathD = wedgePathUp(stepDeg, HUB_RADIUS_PX, wedgeOuterR);
	const wedgeGradientId = `${menuId}-wedge-fill`;
	const wedgeGradientDestructiveId = `${menuId}-wedge-fill-destructive`;

	const aimTransition = reduceMotion ? { duration: 0 } : SPRING_AIM;
	const enterTransition = reduceMotion ? { duration: 0 } : SPRING_ENTER;
	const exitTransition = reduceMotion ? { duration: 0 } : SPRING_EXIT;

	/** Icon sits at the center of each segment (wedge aligned to these angles). */
	const itemAngles = useMemo(() => {
		if (count === 0) return [];
		return items.map((_, index) => stepDeg * index);
	}, [count, items, stepDeg]);

	useEffect(() => {
		setMounted(true);
	}, []);

	// RMB release fires `contextmenu` after this overlay unmounts — swallow it briefly.
	useEffect(() => {
		const blockLateContextMenu = (event: MouseEvent) => {
			if (!shouldSuppressNativeContextMenu()) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		document.addEventListener("contextmenu", blockLateContextMenu, true);
		return () =>
			document.removeEventListener("contextmenu", blockLateContextMenu, true);
	}, []);

	useEffect(() => {
		activeIndexRef.current = activeIndex;
	}, [activeIndex]);

	useEffect(() => {
		if (!open) return;
		setActiveIndex(NO_SELECTION);
		activeIndexRef.current = NO_SELECTION;
		prevActiveIndexRef.current = NO_SELECTION;
		wedgeRotateRef.current = 0;
		setWedgeRotate(0);
	}, [open]);

	useEffect(() => {
		if (activeIndex < 0) return;

		const nextAngle = itemAngles[activeIndex] ?? 0;
		const nextRotate = shortestRotateTarget(wedgeRotateRef.current, nextAngle);
		wedgeRotateRef.current = nextRotate;
		setWedgeRotate(nextRotate);
		prevActiveIndexRef.current = activeIndex;
	}, [activeIndex, itemAngles]);

	const close = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	const activateIndex = useCallback(
		(index: number) => {
			const item = items[index];
			if (!item || item.disabled) return;
			item.onSelect();
		},
		[items],
	);

	const updateAimFromPointer = useCallback(
		(clientX: number, clientY: number) => {
			if (!clampedAnchor || count === 0) return;
			const dx = clientX - clampedAnchor.x;
			const dy = clientY - clampedAnchor.y;
			if (Math.hypot(dx, dy) < HUB_DEAD_ZONE_PX) {
				setActiveIndex(NO_SELECTION);
				activeIndexRef.current = NO_SELECTION;
				return;
			}

			const deg = pointerAngleDeg(
				clampedAnchor.x,
				clampedAnchor.y,
				clientX,
				clientY,
			);
			const idx = segmentIndex(deg, count, stepDeg);
			if (items[idx]?.disabled) {
				setActiveIndex(NO_SELECTION);
				activeIndexRef.current = NO_SELECTION;
				return;
			}
			setActiveIndex(idx);
			activeIndexRef.current = idx;
		},
		[clampedAnchor, count, items, stepDeg],
	);

	useEffect(() => {
		if (!open) return;
		sessionRef.current = true;

		const endSession = (confirm: boolean) => {
			if (!sessionRef.current) return;
			sessionRef.current = false;
			armNativeContextMenuSuppression();
			if (confirm && activeIndexRef.current >= 0) {
				activateIndex(activeIndexRef.current);
			}
			close();
		};

		const onPointerMove = (event: PointerEvent) => {
			if ((event.buttons & 2) === 0) return;
			updateAimFromPointer(event.clientX, event.clientY);
		};

		const onPointerUp = (event: PointerEvent) => {
			if (event.button !== 2) return;
			event.preventDefault();
			event.stopPropagation();
			endSession(true);
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				endSession(false);
			}
		};

		const onContextMenu = (event: MouseEvent) => {
			event.preventDefault();
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("contextmenu", onContextMenu, true);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("contextmenu", onContextMenu, true);
			sessionRef.current = false;
		};
	}, [open, close, activateIndex, updateAimFromPointer]);

	if (!mounted || !clampedAnchor || count === 0) return null;

	const hasSelection = activeIndex >= 0;
	const activeItem = hasSelection ? items[activeIndex] : undefined;
	const activeIsDestructive = activeItem?.variant === "destructive";
	const activeAccent = activeIsDestructive ? ACTION_DESTRUCTIVE : ACTION_BLUE;
	const activeAngle = hasSelection ? (itemAngles[activeIndex] ?? 0) : 0;
	const { pos: activeLabelPos, motion: activeLabelMotion } =
		activeLabelAnchor(activeAngle);

	const portal = (
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					role="presentation"
					aria-hidden
					className="fixed inset-0 z-[200] touch-none select-none bg-black/45"
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? { opacity: 0 } : fadeUpExit}
					transition={exitTransition}
				>
					<motion.div
						role="menu"
						id={menuId}
						aria-label={title}
						aria-activedescendant={
							activeItem ? `${menuId}-${activeItem.id}` : undefined
						}
						className="pointer-events-none fixed"
						style={{
							left: clampedAnchor.x,
							top: clampedAnchor.y,
							width: TRACK_SIZE_PX,
							height: TRACK_SIZE_PX,
							marginLeft: -TRACK_CENTER,
							marginTop: -TRACK_CENTER,
							position: "relative",
						}}
						variants={reduceMotion ? undefined : menuShellVariants}
						initial={reduceMotion ? false : "hidden"}
						animate="visible"
						exit={reduceMotion ? { opacity: 0 } : fadeUpExit}
						transition={enterTransition}
					>
						{/* Orbit ring — stroke only, sized to the action orbit */}
						<motion.div
							aria-hidden
							variants={reduceMotion ? undefined : pieceVariants}
							className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4.5px] border-white/80"
							style={{ width: ORBIT_RING_PX, height: ORBIT_RING_PX }}
						/>

						{/* Wedge — spring rotate on shortest path; fades when over hub */}
						<motion.div
							aria-hidden
							className="absolute inset-0 origin-center will-change-transform"
							animate={{
								opacity: hasSelection ? 1 : 0,
								scale: hasSelection ? 1 : 0.96,
								rotate: wedgeRotate,
							}}
							transition={aimTransition}
							style={{
								width: TRACK_SIZE_PX,
								height: TRACK_SIZE_PX,
							}}
						>
							<svg
								aria-hidden
								className="overflow-visible"
								width={TRACK_SIZE_PX}
								height={TRACK_SIZE_PX}
								viewBox={`0 0 ${TRACK_SIZE_PX} ${TRACK_SIZE_PX}`}
							>
								<title>Aim wedge</title>
								<defs>
									{/* Outer edge = accent; fades to transparent toward the hub. */}
									<radialGradient
										id={wedgeGradientId}
										gradientUnits="userSpaceOnUse"
										cx={TRACK_CENTER}
										cy={TRACK_CENTER}
										r={wedgeOuterR}
										fx={TRACK_CENTER}
										fy={TRACK_CENTER}
									>
										{wedgeGradientStops(ACTION_BLUE)}
									</radialGradient>
									<radialGradient
										id={wedgeGradientDestructiveId}
										gradientUnits="userSpaceOnUse"
										cx={TRACK_CENTER}
										cy={TRACK_CENTER}
										r={wedgeOuterR}
										fx={TRACK_CENTER}
										fy={TRACK_CENTER}
									>
										{wedgeGradientStops(ACTION_DESTRUCTIVE)}
									</radialGradient>
								</defs>
								<path
									d={wedgePathD}
									fill={`url(#${activeIsDestructive ? wedgeGradientDestructiveId : wedgeGradientId})`}
								/>
							</svg>
						</motion.div>

						{/* Center hub — X hints: aim here and release to dismiss without an action */}
						<motion.div
							aria-hidden
							variants={reduceMotion ? undefined : pieceVariants}
							className="absolute top-1/2 left-1/2 flex size-[3.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[4px] bg-white text-zinc-400 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.2)]"
							style={{ borderColor: ACTION_BLUE }}
						>
							<motion.span
								className="grid place-items-center"
								animate={{
									opacity: hasSelection ? 0.38 : 1,
									scale: hasSelection ? 0.88 : 1,
									color: hasSelection ? "rgb(161 161 170)" : ACTION_BLUE,
								}}
								transition={aimTransition}
							>
								<IconXmarkFill12 className="size-3.5" aria-hidden />
							</motion.span>
						</motion.div>

						{/* Orbit icons — staggered enter; spring scale when aimed */}
						{items.map((item, index) => {
							const angle = itemAngles[index] ?? 0;
							const pos = polarToXY(ORBIT_RADIUS_PX, angle);
							const isActive = hasSelection && index === activeIndex;
							const itemAccent =
								item.variant === "destructive"
									? ACTION_DESTRUCTIVE
									: ACTION_BLUE;

							return (
								<motion.div
									key={item.id}
									id={isActive ? `${menuId}-${item.id}` : undefined}
									role="menuitem"
									aria-label={
										item.shortcut
											? `${item.label} (${item.shortcut})`
											: item.label
									}
									aria-disabled={item.disabled || undefined}
									variants={reduceMotion ? undefined : pieceVariants}
									className="absolute -translate-x-1/2 -translate-y-1/2"
									style={{ left: pos.x, top: pos.y }}
								>
									<motion.div
										className={cn(
											"relative flex size-11 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)] will-change-transform",
											item.disabled && "opacity-35",
										)}
										animate={{
											scale: isActive ? 1.06 : 1,
											color: isActive ? itemAccent : "rgb(63 63 70)",
										}}
										transition={aimTransition}
									>
										{/* Border ring — boxShadow strings don't spring; animate border instead. */}
										<motion.span
											aria-hidden
											className="pointer-events-none absolute inset-0 rounded-xl border-2 border-transparent"
											initial={false}
											animate={{
												opacity: isActive ? 1 : 0,
												scale: isActive ? 1 : 0.94,
												borderColor: isActive
													? itemAccent
													: "rgba(56, 189, 248, 0)",
											}}
											transition={
												reduceMotion ? { duration: 0 } : SPRING_ICON_RING
											}
										/>
										<span className="relative z-10 grid size-6 place-items-center [&_svg]:size-6">
											{item.icon}
										</span>
									</motion.div>
								</motion.div>
							);
						})}

						{/* Active label — one pill that springs between segment positions */}
						<AnimatePresence initial={false}>
							{hasSelection && activeItem ? (
								<motion.div
									key="radial-active-label"
									aria-hidden
									className="pointer-events-none absolute flex items-center gap-2 rounded-full px-3 py-1.5 text-white will-change-[left,top,transform,opacity,background-color]"
									initial={
										reduceMotion
											? false
											: {
													opacity: 0,
													scale: 0.9,
													backgroundColor: activeAccent,
													left: activeLabelPos.x,
													top: activeLabelPos.y,
													...activeLabelMotion,
												}
									}
									animate={{
										opacity: 1,
										scale: 1,
										backgroundColor: activeAccent,
										left: activeLabelPos.x,
										top: activeLabelPos.y,
										...activeLabelMotion,
									}}
									exit={
										reduceMotion
											? { opacity: 0 }
											: { opacity: 0, scale: 0.94, filter: "blur(3px)" }
									}
									transition={aimTransition}
								>
									<AnimatePresence initial={false} mode="popLayout">
										<motion.span
											key={activeItem.id}
											className="whitespace-nowrap font-medium text-sm"
											initial={
												reduceMotion
													? false
													: { opacity: 0, filter: "blur(4px)" }
											}
											animate={{ opacity: 1, filter: "blur(0px)" }}
											exit={{ opacity: 0, filter: "blur(3px)" }}
											transition={
												reduceMotion ? { duration: 0 } : { duration: 0.12 }
											}
										>
											{activeItem.label}
										</motion.span>
									</AnimatePresence>
									{activeItem.shortcut ? (
										<motion.span
											animate={{ color: activeAccent }}
											transition={aimTransition}
											className="inline-flex"
										>
											<kbd className="rounded-md bg-foreground px-1.5 py-0.5 font-medium text-[10px] text-inherit tabular-nums">
												{activeItem.shortcut}
											</kbd>
										</motion.span>
									) : null}
								</motion.div>
							) : null}
						</AnimatePresence>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return createPortal(portal, document.body);
}
