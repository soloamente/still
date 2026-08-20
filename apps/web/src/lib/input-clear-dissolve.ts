/**
 * transitions.dev — input clear with dissolve (per-frame streak + text fly).
 * Used by sticky catalogue search clear; reads `--clear-*` / `--glow-*` from CSS.
 */

export type InputClearDissolveElements = {
	wrap: HTMLElement;
	mirror: HTMLElement;
	placeholder: HTMLElement;
	glow: HTMLElement;
	/** Element whose computed font drives per-word glow metrics. */
	fontSource: HTMLElement;
};

export type InputClearDissolveOptions = {
	/** Text that flies out (already resolved summary / free text). */
	text: string;
	/** Dark shell → white streaks + higher opacity; light → black + multiply. */
	isDark: boolean;
	reducedMotion?: boolean;
	onComplete?: () => void;
};

export type InputClearDissolveHandle = {
	cancel: () => void;
};

/** Read a unitless number from a CSS custom property on `:root`. */
export function readCssNumber(name: string, fallback: number): number {
	if (typeof document === "undefined") return fallback;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Minimal cubic-bezier(x1,y1,x2,y2) sampler so JS easing matches CSS.
 * Exported for unit tests.
 */
export function sampleCubicBezier(str: string): (t: number) => number {
	const match = String(str).match(
		/cubic-bezier\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/,
	);
	if (!match) return (t) => t;
	const [x1, y1, x2, y2] = match
		.slice(1)
		.map((part) => Number.parseFloat(part));
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	return (t) => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		let s = t;
		for (let i = 0; i < 8; i++) {
			const dx = ((ax * s + bx) * s + cx) * s - t;
			const d = (3 * ax * s + 2 * bx) * s + cx;
			if (Math.abs(dx) < 1e-6 || d === 0) break;
			s -= dx / d;
		}
		return ((ay * s + by) * s + cy) * s;
	};
}

function buildGlowBackground(
	text: string,
	wrap: HTMLElement,
	fontSource: HTMLElement,
	isDark: boolean,
): string {
	const canvas = document.createElement("canvas").getContext("2d");
	if (!canvas) return "";
	canvas.font = getComputedStyle(fontSource).font;
	const rgb = isDark ? "255,255,255" : "0,0,0";
	const w = wrap.clientWidth || 280;
	const padLeft =
		Number.parseFloat(getComputedStyle(fontSource).paddingLeft) || 0;
	const spread = readCssNumber("--glow-spread", 1.5);
	const layers: string[] = [];
	let x = 0;
	for (const seg of text.split(/(\s+)/)) {
		const segW = canvas.measureText(seg).width;
		if (seg.trim()) {
			const cx = padLeft + x + segW / 2;
			const hw = Math.max(segW * 0.45, 8) * spread;
			(
				[
					[0, 0.8, 7, 0.22],
					[hw * 0.45, 0.55, 8, 0.18],
					[-hw * 0.4, 0.65, 6, 0.16],
					[hw * 0.15, 0.9, 5, 0.14],
				] as const
			).forEach(([dx, rwm, rh, a]) => {
				const lx = (((cx + dx) / w) * 100).toFixed(2);
				layers.push(
					`radial-gradient(ellipse ${Math.max(hw * rwm, 2).toFixed(1)}px ${rh}px at ${lx}% 100%, rgba(${rgb},${a}), transparent)`,
				);
			});
		}
		x += segW;
	}
	return layers.join(", ");
}

/**
 * Runs the dissolve once. Caller should already have set `.is-clearing` and
 * mirrored text into `mirror` before calling (or pass `text` and we set it).
 */
export function runInputClearDissolve(
	elements: InputClearDissolveElements,
	options: InputClearDissolveOptions,
): InputClearDissolveHandle {
	const { wrap, mirror, placeholder, glow, fontSource } = elements;
	const { text, isDark, reducedMotion = false, onComplete } = options;

	// Visual teardown only — cancel must not fire onComplete (avoids double navigate).
	// Leave `.is-clearing` on the wrap when React owns that class (sticky search).
	const cleanup = () => {
		mirror.style.cssText = "";
		placeholder.style.cssText = "";
		mirror.textContent = "";
		glow.style.opacity = "0";
		glow.style.background = "";
	};

	const finish = () => {
		// Side effects first so hosts can navigate while live content stays hidden.
		onComplete?.();
		cleanup();
	};

	if (reducedMotion || !text.trim()) {
		finish();
		return { cancel: () => undefined };
	}

	const rootStyle = getComputedStyle(document.documentElement);
	const total = readCssNumber("--clear-dur", 1000);
	const outDur = readCssNumber("--clear-out-dur", 400);
	const inDur = readCssNumber("--clear-in-dur", 400);
	const outFly = readCssNumber("--clear-out-fly", 12);
	const inFly = readCssNumber("--clear-in-fly", 12);
	const blur = readCssNumber("--clear-blur", 2);
	const delay = readCssNumber("--glow-delay", 50);
	const peakAt = readCssNumber("--glow-peak-at", 0.15);
	const gOp = readCssNumber("--glow-opacity", isDark ? 0.85 : 0.42);
	const easeOut = sampleCubicBezier(
		rootStyle.getPropertyValue("--clear-out-ease"),
	);
	const easeIn = sampleCubicBezier(
		rootStyle.getPropertyValue("--clear-in-ease"),
	);

	const displayText = text.replace(/ /g, "\u00a0");
	mirror.textContent = displayText;
	// Hosts may already set `.is-clearing` via React; keep the class for vanilla mounts.
	wrap.classList.add("is-clearing");
	glow.style.background = buildGlowBackground(
		displayText,
		wrap,
		fontSource,
		isDark,
	);
	glow.style.opacity = "0";
	placeholder.style.transform = `translateY(-${inFly}px)`;
	placeholder.style.opacity = "0.9";
	placeholder.style.filter = `blur(${blur}px)`;

	let rafId = 0;
	let cancelled = false;
	const t0 = performance.now();

	const tick = (now: number) => {
		if (cancelled) return;
		const elapsed = now - t0;
		const eo = easeOut(Math.min(1, elapsed / outDur));
		mirror.style.transform = `translateY(${(eo * outFly).toFixed(1)}px)`;
		mirror.style.opacity = (1 - eo).toFixed(3);
		mirror.style.filter = `blur(${(eo * blur).toFixed(1)}px)`;

		const ei = easeIn(Math.min(1, elapsed / inDur));
		placeholder.style.transform = `translateY(${(-inFly + ei * inFly).toFixed(1)}px)`;
		placeholder.style.opacity = (0.9 + ei * 0.1).toFixed(3);
		placeholder.style.filter = `blur(${(blur - ei * blur).toFixed(1)}px)`;

		let g = 0;
		if (elapsed > delay) {
			const gp = Math.min(1, (elapsed - delay) / Math.max(1, total - delay));
			g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt);
		}
		glow.style.opacity = (g * gOp).toFixed(3);

		if (elapsed < total) {
			rafId = requestAnimationFrame(tick);
		} else {
			finish();
		}
	};

	rafId = requestAnimationFrame(tick);

	return {
		cancel: () => {
			cancelled = true;
			if (rafId) cancelAnimationFrame(rafId);
			cleanup();
		},
	};
}
