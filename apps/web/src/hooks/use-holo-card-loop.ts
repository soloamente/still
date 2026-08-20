"use client";

import { type RefObject, useEffect, useRef } from "react";

import {
	type ApplyFoilOpts,
	applyFoil,
	applyFrame,
	type Foil,
	Follow,
	fromPointer,
	Kick,
} from "@/lib/holo/engine";

export interface UseHoloCardLoopArgs {
	/** Pointer hit target (flip stage). IntersectionObserver watches this. */
	hostRef: RefObject<HTMLElement | null>;
	/** Front + back face hosts — same foil paint; back (index > 0) gets inverted X tilt/sheet. */
	faceRefs: RefObject<HTMLElement | null>[];
	foil: Foil;
	opts: ApplyFoilOpts;
	/**
	 * Caller gate: typically `hoverCapable && !reduceMotion && !softwareGpu`.
	 * When false: one settled frame at (0,0), no idle drift, no rAF.
	 */
	enabled: boolean;
}

/**
 * One pointer-driven rAF owner for both membership-card faces.
 *
 * Ported from the Vault HoloCard effect: Follow tilt + lagged sheet + Kick on
 * leave, idle drift when untouched, grab/release blends so the card never
 * teleports. Sense skips view-transition hooks and device orientation (v1).
 */
export function useHoloCardLoop({
	hostRef,
	faceRefs,
	foil,
	opts,
	enabled,
}: UseHoloCardLoopArgs): void {
	// Keep latest material/opts/faces without tearing down the loop on every
	// parent re-render (callers often pass a fresh `[front, back]` array).
	const foilRef = useRef(foil);
	foilRef.current = foil;
	const optsRef = useRef(opts);
	optsRef.current = opts;
	const faceRefsRef = useRef(faceRefs);
	faceRefsRef.current = faceRefs;

	/** Push static material vars onto every mounted face. */
	const paintFoil = () => {
		const f = foilRef.current;
		const o = optsRef.current;
		for (const faceRef of faceRefsRef.current) {
			const el = faceRef.current;
			if (el) applyFoil(el, f, o);
		}
	};

	/** Write one pose to every face — live parallax/bloom come from the foil. */
	const paintFrame = (
		tilt: { x: number; y: number },
		sheet: { x: number; y: number },
		motion: {
			speed?: number;
			velocity?: { x: number; y: number };
			time?: number;
		} = {},
	) => {
		const f = foilRef.current;
		const live = { parallax: f.parallax, bloom: f.bloom };
		faceRefsRef.current.forEach((faceRef, index) => {
			const el = faceRef.current;
			if (!el) return;
			// Back face is under CSS rotateY(180deg) — invert X so tilt tracks the pointer.
			const faceTilt = index > 0 ? { x: -tilt.x, y: tilt.y } : tilt;
			const faceSheet = index > 0 ? { x: -sheet.x, y: sheet.y } : sheet;
			applyFrame(el, faceTilt, faceSheet, f, live, motion);
		});
	};

	// Material / print change — not every animation frame.
	useEffect(() => {
		paintFoil();
	}, [foil, opts.tileSrc, opts.bodyGrad, opts.tileDark, opts.tileLight]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		// Soft GPU / reduced motion / no hover: settle once and stay quiet.
		if (!enabled) {
			paintFrame({ x: 0, y: 0 }, { x: 0, y: 0 });
			return;
		}

		// Two followers at different weights. The card tracks quickly; the foil is
		// heavier and arrives a few frames later, so the surface catches up to the
		// card rather than moving with it.
		const tilt = new Follow(0.16);
		const sheet = new Follow(0.09);
		/** Fires once when the pointer leaves, carrying the speed you left at. */
		const kick = new Kick();
		/** Wall-clock seconds since mount, for the resting cycles. */
		const t0 = performance.now();

		let raf = 0;
		let running = false;
		let onScreen = false;
		let hidden = document.hidden;
		/** A slow wander when untouched, so the card is alive before you reach it. */
		let idle = 0;
		let touched = false;
		/** How far through the return-to-rest blend we are, 0..1. */
		let release = 1;
		/** Where the card was pointing when the pointer left — start of the blend. */
		let handoff = { x: 0, y: 0 };
		/**
		 * Ease onto the pointer after idle drift so the first move is not a
		 * teleport across most of the card's travel in one frame.
		 */
		let grab = 1;
		let grabFrom = { x: 0, y: 0 };
		/** Live pointer reading — frame loop blends toward it. */
		let aim = { x: 0, y: 0 };

		const frame = () => {
			raf = 0;

			if (!touched) {
				// Two incommensurate rates, so the resting drift never visibly repeats.
				idle += 0.0042;
				const drift = {
					x: Math.sin(idle) * 0.28,
					y: Math.cos(idle * 0.73) * 0.2,
				};
				// Ease back into drift from handoff — do not cut to the drift phase.
				release = Math.min(1, release + 0.016);
				const k = release * release;
				tilt.target = {
					x: handoff.x + (drift.x - handoff.x) * k,
					y: handoff.y + (drift.y - handoff.y) * k,
				};
			}

			if (touched) {
				// Ease from where the card was into where the pointer is.
				grab = Math.min(1, grab + 0.018);
				const k = grab * grab;
				tilt.target = {
					x: grabFrom.x + (aim.x - grabFrom.x) * k,
					y: grabFrom.y + (aim.y - grabFrom.y) * k,
				};
			}

			// Release overshoot rides on top of the target rather than replacing it.
			const kickOffset = kick.step();
			if (kickOffset.x || kickOffset.y) {
				tilt.target = {
					x: tilt.target.x + kickOffset.x,
					y: tilt.target.y + kickOffset.y,
				};
			}

			tilt.step();
			sheet.target = tilt.value;
			sheet.step();

			paintFrame(tilt.value, sheet.value, {
				speed: sheet.speed,
				velocity: sheet.velocity,
				time: (performance.now() - t0) / 1000,
			});

			// Keep running while return/grab blends are mid-flight, or while idle
			// (untouched) so drift stays alive. Stop when hovering and settled.
			if (
				running &&
				(!touched ||
					release < 1 ||
					grab < 1 ||
					kick.active ||
					!tilt.settled ||
					!sheet.settled)
			) {
				raf = requestAnimationFrame(frame);
			}
		};

		const wake = () => {
			if (!running || raf) return;
			raf = requestAnimationFrame(frame);
		};

		const onPointer = (e: PointerEvent) => {
			aim = fromPointer(host.getBoundingClientRect(), e.clientX, e.clientY);
			if (!touched) {
				// First contact only — restarting grab every move permanently lags.
				touched = true;
				grabFrom = { x: tilt.value.x, y: tilt.value.y };
				grab = 0;
			}
			release = 0;
			wake();
		};

		const onLeave = () => {
			touched = false;
			handoff = { x: tilt.value.x, y: tilt.value.y };
			release = 0;
			grab = 1;
			kick.fire(tilt.velocity);
			wake();
		};

		const sync = () => {
			const should = onScreen && !hidden;
			if (should === running) return;
			running = should;
			if (should) wake();
			else if (raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
		};

		const io = new IntersectionObserver(
			(entries) => {
				onScreen = entries.some((entry) => entry.isIntersecting);
				sync();
			},
			{ rootMargin: "200px" },
		);
		io.observe(host);

		const onVis = () => {
			hidden = document.hidden;
			sync();
		};
		document.addEventListener("visibilitychange", onVis);

		host.addEventListener("pointermove", onPointer);
		host.addEventListener("pointerleave", onLeave);

		return () => {
			running = false;
			if (raf) cancelAnimationFrame(raf);
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
			host.removeEventListener("pointermove", onPointer);
			host.removeEventListener("pointerleave", onLeave);
		};
	}, [enabled, hostRef]);
}
