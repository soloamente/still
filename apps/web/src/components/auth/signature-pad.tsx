"use client";

import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import {
	type CSSProperties,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

/* ══ Signature pad ════════════════════════════════════════
   Sign on the line. The ink thins as the pen moves faster and
   pools as it slows, the way a real nib does — which is most
   of what makes a scribble read as a signature rather than a
   trace of the mouse.

   ── AND THEN IT GETS OUT OF THE WAY ─────────────────────
   Pause after the last stroke and the pad folds itself into a
   small pill that says Signed — the whole card shrinking into
   the confirmation, rather than a line of small print under
   the signature. Press the pill to sign again.

   ── CLEAR REWINDS ───────────────────────────────────────
   Clear does not wipe. The ink un-draws, last point first, all
   the way back to the first touch — the signature taken back
   in the order it was given.

   ── SVG, NOT A CANVAS ───────────────────────────────────
   Every segment is its own short curve with its own width. A
   canvas would need its pixel ratio guessed for a block the
   wall draws at 0.8 and the overlay at 1.4, and would not
   follow the Fill control without being told to repaint; an
   SVG is crisp at any scale and its ink is currentColor. */

const W = 320;
const H = 180;
/* where the line is, in the block's own pixels */
const LINE_Y = 128;
const INSET = 28;
/* create-account CTA height (idle + continue) */
const CTA_H = 44;
/* signed stack: continue + sign-again */
const SIGNED_STACK_H = 72;

type Pt = { x: number; y: number; w: number };
type Phase = "idle" | "signing" | "signed";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/* one stroke as short quadratic pieces through the midpoints,
   each as wide as the pen was there */
function pieces(s: Pt[], upto: number, key: string) {
	const out: ReactNode[] = [];
	const n = Math.min(s.length, upto);
	if (n <= 0) return out;
	if (n === 1 || s.length === 1) {
		out.push(
			<circle
				key={key}
				cx={s[0].x}
				cy={s[0].y}
				r={s[0].w / 2}
				fill="currentColor"
			/>,
		);
		return out;
	}
	for (let i = 1; i < n; i++) {
		const a = s[i - 1];
		const b = s[i];
		const start =
			i === 1 ? a : { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 };
		const end =
			i === s.length - 1 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
		out.push(
			<path
				key={`${key}-${i}`}
				d={`M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
				strokeWidth={((a.w + b.w) / 2).toFixed(2)}
			/>,
		);
	}
	return out;
}

export function SignaturePad({
	/* how heavy the pen is, 0..100 */
	pen = 50,
	/* how much the hand's wobble is taken out, 0..100 */
	smooth = 50,
	ink = "Black",
	/* how fast Clear un-draws, 0..100 */
	rewind = 50,
	corner = 16,
	/**
	 * Create-account flow: Accept terms and policy morphs into the pad,
	 * then folds back so Create account submits or Sign again remakes.
	 */
	asCreateAccount = false,
	/** Email/password ready — idle CTA may open the pad. */
	canStart = true,
	isSubmitting = false,
	/** Return false to keep the idle CTA (e.g. validation failed). */
	onRequestStart,
	onSignedChange,
}: {
	pen?: number;
	smooth?: number;
	ink?: string;
	rewind?: number;
	corner?: number;
	asCreateAccount?: boolean;
	canStart?: boolean;
	isSubmitting?: boolean;
	onRequestStart?: () => boolean;
	/** True after the pad folds; false on clear or sign-again. */
	onSignedChange?: (signed: boolean) => void;
} = {}) {
	const pad = useRef<HTMLDivElement>(null);
	const strokes = useRef<Pt[][]>([]);
	const [, setV] = useState(0);
	const redraw = () => setV((v) => v + 1);
	const [cut, setCut] = useState<number | null>(null);
	const [phase, setPhase] = useState<Phase>(
		asCreateAccount ? "idle" : "signing",
	);
	const down = useRef(false);
	const last = useRef({ x: 0, y: 0, t: 0, w: 0 });
	const later = useRef(0);
	const raf = useRef(0);
	const knobs = useRef({ pen, smooth, rewind });
	knobs.current = { pen, smooth, rewind };
	const onSignedChangeRef = useRef(onSignedChange);
	onSignedChangeRef.current = onSignedChange;

	const signed = phase === "signed";
	const open = phase === "signing" || (!asCreateAccount && !signed);
	const idle = asCreateAccount && phase === "idle";

	useEffect(
		() => () => {
			clearTimeout(later.current);
			cancelAnimationFrame(raf.current);
		},
		[],
	);

	/* the pen's two widths, both of which move with the knob so
     neither end of it is a pen that cannot vary */
	const widths = () => {
		const p = clamp(knobs.current.pen, 0, 100) / 100;
		return { thin: 0.8 + p * 2, thick: 2.2 + p * 5 };
	};

	/* the pointer, in the block's own pixels — the block is drawn
     scaled on the wall and in the overlay */
	const local = (e: PointerEvent<HTMLDivElement>) => {
		const host = pad.current;
		if (!host) return { x: 0, y: 0 };
		const r = host.getBoundingClientRect();
		return {
			x: ((e.clientX - r.left) * W) / r.width,
			y: ((e.clientY - r.top) * H) / r.height,
		};
	};

	const rewinding = cut !== null;
	const total = strokes.current.reduce((n, s) => n + s.length, 0);
	const inked = total > 0;

	const openPad = () => {
		if (asCreateAccount) {
			if (!canStart) {
				onRequestStart?.();
				return;
			}
			if (onRequestStart && !onRequestStart()) return;
		}
		clearTimeout(later.current);
		strokes.current = [];
		setCut(null);
		setPhase("signing");
		onSignedChangeRef.current?.(false);
	};

	const markSigned = () => {
		setPhase("signed");
		onSignedChangeRef.current?.(true);
	};

	const onDown = (e: PointerEvent<HTMLDivElement>) => {
		if (!open || rewinding || signed) return;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			/* a scripted pointer */
		}
		down.current = true;
		clearTimeout(later.current);
		const p = local(e);
		const { thin, thick } = widths();
		const w = (thin + thick) / 2;
		last.current = { ...p, t: performance.now(), w };
		strokes.current.push([{ ...p, w }]);
		redraw();
	};

	const onMove = (e: PointerEvent<HTMLDivElement>) => {
		if (!down.current) return;
		const raw = local(e);
		const l = last.current;
		/* smoothing: the pen follows the hand on a lag */
		const k = 1 - (clamp(knobs.current.smooth, 0, 100) / 100) * 0.75;
		const x = l.x + (raw.x - l.x) * k;
		const y = l.y + (raw.y - l.y) * k;
		const d = Math.hypot(x - l.x, y - l.y);
		if (d < 0.8) return;
		const t = performance.now();
		const v = d / Math.max(1, t - l.t);
		const { thin, thick } = widths();
		/* fast is thin, slow pools; and the width itself eases, so
       a single quick frame cannot make a notch in the line */
		const target = thick - (thick - thin) * clamp(v / 1.6, 0, 1);
		const w = l.w + (target - l.w) * 0.35;
		last.current = { x, y, t, w };
		strokes.current[strokes.current.length - 1].push({ x, y, w });
		redraw();
	};

	const onUp = (e: PointerEvent<HTMLDivElement>) => {
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			/* never captured */
		}
		if (!down.current) return;
		down.current = false;
		clearTimeout(later.current);
		/* a pause after the last stroke is what signing IS */
		later.current = window.setTimeout(() => {
			if (!down.current && strokes.current.length) {
				markSigned();
			}
		}, 1500);
	};

	const clear = () => {
		if (!inked || rewinding) return;
		clearTimeout(later.current);
		onSignedChangeRef.current?.(false);
		const n = total;
		const per = 2 + ((100 - clamp(knobs.current.rewind, 0, 100)) / 100) * 8;
		const dur = clamp(n * per, 350, 2400);
		const t0 = performance.now();
		const step = (t: number) => {
			const k = Math.min(1, (t - t0) / dur);
			setCut(Math.round(n * (1 - ease(k))));
			if (k < 1) {
				raf.current = requestAnimationFrame(step);
				return;
			}
			strokes.current = [];
			setCut(null);
			if (asCreateAccount) setPhase("signing");
		};
		raf.current = requestAnimationFrame(step);
	};

	/* the pill, pressed: the ink goes while nobody can see it,
     and the pad opens back out empty */
	const again = () => {
		strokes.current = [];
		setCut(null);
		onSignedChangeRef.current?.(false);
		setPhase("signing");
	};

	/* draw up to the cut, stroke by stroke */
	const ink$: ReactNode[] = [];
	let left = cut ?? Number.POSITIVE_INFINITY;
	strokes.current.forEach((s, i) => {
		if (left <= 0) return;
		ink$.push(...pieces(s, left, String(i)));
		left -= s.length;
	});

	const r = clamp(corner, 0, 28);
	/* the Clear pill sits 10 in: concentric once there is a curve */
	const inner = Math.max(0, r - 10 * Math.min(1, r / 20));

	const frameH = idle
		? CTA_H
		: signed && asCreateAccount
			? SIGNED_STACK_H
			: open
				? H
				: CTA_H;

	const sigStyle = {
		/* width and height, never a scale: the corner has to stay
           a corner all the way down to the pill */
		width: "100%",
		height: signed && asCreateAccount ? SIGNED_STACK_H : idle ? CTA_H : "100%",
		"--r": idle || (signed && asCreateAccount) ? "1rem" : `${r}px`,
		"--inner": `${Math.min(14, inner)}px`,
	} as CSSProperties;

	return (
		/* a fixed frame, so folding into the pill never rescales
       the block on the wall */
		<div
			className={cn(
				"sig-frame",
				asCreateAccount ? "w-full max-w-none" : "mx-auto w-full max-w-[320px]",
			)}
			style={{
				width: asCreateAccount ? "100%" : W,
				height: frameH,
				maxWidth: asCreateAccount && open ? W : undefined,
				marginInline: asCreateAccount && open ? "auto" : undefined,
			}}
		>
			{idle ? (
				<button
					type="button"
					className="sig sig--account sig--idle-cta"
					style={sigStyle}
					onClick={openPad}
				>
					<span className="sig-idle-label">Accept terms and policy</span>
				</button>
			) : (
				<div
					ref={pad}
					className={cn(
						"sig",
						asCreateAccount && "sig--account",
						signed && asCreateAccount && "sig--continue-cta",
					)}
					data-ink={ink}
					data-phase={asCreateAccount ? phase : signed ? "signed" : "signing"}
					data-inked={(inked && !rewinding && open) || undefined}
					data-signed={signed || undefined}
					role="application"
					aria-label={signed ? "Signed" : "Signature pad"}
					style={sigStyle}
					onPointerDown={open ? onDown : undefined}
					onPointerMove={open ? onMove : undefined}
					onPointerUp={open ? onUp : undefined}
					onPointerCancel={open ? onUp : undefined}
					onContextMenu={(e) => e.preventDefault()}
				>
					{/* everything drawn on the pad, on one layer centred in the
          card: signing, it shrinks with the card into the pill's
          middle instead of being cut off by its edges */}
					<div className="sig-face">
						<span
							className="sig-line"
							style={{ top: LINE_Y, left: INSET, right: INSET }}
							aria-hidden="true"
						/>
						<span className="sig-hint" aria-hidden="true">
							Sign here
						</span>
						<svg
							className="sig-ink"
							viewBox={`0 0 ${W} ${H}`}
							width={W}
							height={H}
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							role="img"
							aria-label={inked ? "Signature" : "Empty signature pad"}
						>
							{ink$}
						</svg>
					</div>
					<button
						type="button"
						className="sig-clear"
						tabIndex={inked && !rewinding && open ? 0 : -1}
						onPointerDown={(e) => e.stopPropagation()}
						onClick={clear}
					>
						Clear
					</button>
					<span className="sig-said" aria-live="polite">
						{signed &&
							(asCreateAccount ? (
								<span className="sig-continue-stack">
									<button
										type="submit"
										className="sig-pill sig-pill--continue"
										disabled={isSubmitting}
										onPointerDown={(e) => e.stopPropagation()}
									>
										{isSubmitting ? "Creating…" : "Create account"}
									</button>
									<button
										type="button"
										className="sig-again"
										disabled={isSubmitting}
										onPointerDown={(e) => e.stopPropagation()}
										onClick={again}
									>
										Sign again
									</button>
								</span>
							) : (
								<button
									type="button"
									className="sig-pill"
									aria-label="Signed. Sign again"
									onPointerDown={(e) => e.stopPropagation()}
									onClick={again}
								>
									<Check size={14} strokeWidth={2.6} className="sig-check" />
									Signed
								</button>
							))}
					</span>
				</div>
			)}
		</div>
	);
}
