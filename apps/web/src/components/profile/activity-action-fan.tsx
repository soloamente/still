"use client";

import { cn } from "@still/ui/lib/utils";
import {
	type CSSProperties,
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import "./activity-action-fan.css";

/** Disc diameter. Spacing and the hiding place are measured from this. */
const DOT = 36;
const R = DOT / 2;
const SPACING = DOT + 12;
const BEAT = 90;

const clamp = (value: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, value));

/**
 * One spring for the fan. `dt` is in frames so a dropped frame decays the
 * same energy as the frames it replaced. The loop stops once it has settled.
 */
function springOf(tune: number) {
	return {
		k: 0.08 + (tune / 100) * 0.16,
		d: 0.62 + (tune / 100) * 0.2,
	};
}

function useSpring(target: number, tune = 50, instant = false) {
	const [at, setAt] = useState(target);
	const cur = useRef(target);
	const vel = useRef(0);
	const raf = useRef(0);

	useEffect(() => {
		if (instant) {
			cur.current = target;
			vel.current = 0;
			setAt(target);
			return;
		}
		const { k, d } = springOf(tune);
		let prev = 0;
		const tick = (time: number) => {
			const dt = prev ? clamp((time - prev) / 16.67, 0, 2.5) : 1;
			prev = time;
			vel.current += (target - cur.current) * k * dt;
			vel.current *= d ** dt;
			cur.current += vel.current * dt;
			if (
				Math.abs(target - cur.current) < 0.02 &&
				Math.abs(vel.current) < 0.02
			) {
				cur.current = target;
				vel.current = 0;
				setAt(target);
				raf.current = 0;
				return;
			}
			setAt(cur.current);
			raf.current = requestAnimationFrame(tick);
		};
		raf.current = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf.current);
			raf.current = 0;
		};
	}, [target, tune, instant]);

	return at;
}

function stillness() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
	);
}

/**
 * A point on the card outline pushed out by `off`. Straight on the top edge,
 * around a corner arc concentric with the card, then down the right edge.
 */
function ride(distance: number, corner: number, off: number) {
	const arc = Math.max(0.001, corner + off);
	const len = (arc * Math.PI) / 2;
	if (distance <= 0) {
		return { x: -corner + distance, y: -off };
	}
	if (distance >= len) {
		return { x: off, y: corner + (distance - len) };
	}
	const theta = Math.PI / 2 - distance / arc;
	return {
		x: -corner + arc * Math.cos(theta),
		y: corner - arc * Math.sin(theta),
	};
}

/** Far enough inside the corner that a folded disc does not peek past it. */
function hideAt(corner: number) {
	return corner >= R + 2
		? corner * Math.SQRT2
		: Math.max(R * Math.SQRT2 + 2, corner * Math.SQRT2 + corner + 2);
}

/** Air between the card edge and the button edge, from a 20–40 reach. */
function gapPx(reach: number) {
	return 6 + (clamp(reach, 20, 40) / 100) * 24;
}

const AIR = Math.ceil(gapPx(100) + DOT);

export type ActivityFanAction = {
	id: string;
	label: string;
	icon: ReactNode;
	onClick: () => void;
};

type ActivityActionFanProps = {
	children: ReactElement<{ className?: string }>;
	actions: ActivityFanAction[];
	className?: string;
	/** Extra nodes, such as the add-to-list picker. */
	extra?: ReactNode;
	reach?: number;
	bounce?: number;
	stagger?: number;
	corner?: number;
};

/**
 * Folds the activity card's actions into its top-right corner until the
 * pointer asks for them. Each button rides an offset of the card's own corner.
 */
export function ActivityActionFan({
	children,
	actions,
	className,
	extra,
	reach = 25,
	bounce = 20,
	stagger = 55,
	corner = 24,
}: ActivityActionFanProps) {
	const count = clamp(actions.length, 0, 4);
	const still = stillness();
	const [on, setOn] = useState(false);
	const [lit, setLit] = useState([false, false, false, false]);
	const timers = useRef<number[]>([]);

	useEffect(() => {
		for (const timer of timers.current) window.clearTimeout(timer);
		timers.current = [];
		const gap = still ? 0 : (clamp(stagger, 0, 100) / 100) * BEAT;
		for (let index = 0; index < 4; index += 1) {
			const place = on ? index : count - 1 - index;
			const delay = gap * place;
			const set = () =>
				setLit((prev) => {
					if (prev[index] === on) return prev;
					const next = [...prev];
					next[index] = on;
					return next;
				});
			if (delay <= 0) set();
			else timers.current.push(window.setTimeout(set, delay));
		}
		return () => {
			for (const timer of timers.current) window.clearTimeout(timer);
			timers.current = [];
		};
	}, [on, count, stagger, still]);

	const p0 = useSpring(lit[0] ? 100 : 0, bounce, still);
	const p1 = useSpring(lit[1] ? 100 : 0, bounce, still);
	const p2 = useSpring(lit[2] ? 100 : 0, bounce, still);
	const p3 = useSpring(lit[3] ? 100 : 0, bounce, still);
	const at = [p0, p1, p2, p3];

	const radius = clamp(corner, 0, 32);
	const off = gapPx(reach) + R;
	const mid = ((radius + off) * Math.PI) / 4;
	const spots = Array.from({ length: count }, (_, index) =>
		ride(mid + (index - (count - 1) / 2) * SPACING, radius, off),
	);
	const deep = hideAt(radius) / Math.SQRT2;
	const hidden = { x: -deep, y: deep };

	const bleed = 6;
	const box = spots.reduce(
		(bounds, spot) => ({
			l: Math.min(bounds.l, spot.x - R - bleed),
			r: Math.max(bounds.r, spot.x + R + bleed),
			t: Math.min(bounds.t, spot.y - R - bleed),
			d: Math.max(bounds.d, spot.y + R + bleed),
		}),
		{ l: 0, r: 0, t: 0, d: 0 },
	);
	const padWidth = box.r - box.l;
	const padHeight = box.d - box.t;
	const padX = -box.l;
	const padY = -box.t;
	const biteX = Math.max(0, padX - radius);
	const biteY = Math.min(padHeight, padY + radius);

	const card = isValidElement(children)
		? cloneElement(children, {
				className: cn(children.props.className, "activity-fan-card"),
				"data-on": on ? "" : undefined,
			} as { className?: string; "data-on"?: string })
		: children;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: pointer host so the fan stays open across the gap
		<div
			className={cn("activity-fan", className)}
			style={
				{
					"--nod-r": `${radius}px`,
					paddingBlock: AIR,
				} as CSSProperties
			}
			onPointerEnter={(event) => {
				if (event.pointerType === "touch") return;
				setOn(true);
			}}
			onPointerOut={(event) => {
				const next = event.relatedTarget;
				if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
					setOn(false);
				}
			}}
			onPointerCancel={() => setOn(false)}
			onFocus={() => setOn(true)}
			onBlur={(event) => {
				const next = event.relatedTarget;
				if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
					setOn(false);
				}
			}}
		>
			{card}
			<div className="activity-fan-anchor" style={{ top: AIR, right: 0 }}>
				<i
					className="activity-fan-reach"
					aria-hidden="true"
					data-on={on ? "" : undefined}
					style={{
						left: box.l,
						top: box.t,
						width: padWidth,
						height: padHeight,
						clipPath: `polygon(0 0, ${padWidth}px 0, ${padWidth}px ${padHeight}px, ${biteX}px ${padHeight}px, ${biteX}px ${biteY}px, 0 ${biteY}px)`,
					}}
				/>
				{actions.slice(0, count).map((action, index) => {
					const progress = clamp((at[index] ?? 0) / 100, 0, 1.4);
					const spot = spots[index];
					if (!spot) return null;
					const place = (from: number, to: number) =>
						from + (to - from) * progress;
					return (
						<button
							key={action.id}
							className="activity-fan-act"
							type="button"
							aria-label={action.label}
							title={action.label}
							tabIndex={on ? 0 : -1}
							style={
								{
									width: DOT,
									height: DOT,
									marginTop: -R,
									marginLeft: -R,
									translate: `${place(hidden.x, spot.x)}px ${place(hidden.y, spot.y)}px`,
									"--pop": 0.82 + 0.18 * Math.min(progress, 1),
								} as CSSProperties
							}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								action.onClick();
							}}
						>
							{action.icon}
						</button>
					);
				})}
			</div>
			{extra}
		</div>
	);
}
