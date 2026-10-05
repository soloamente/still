import {
	type CompanionLoggedNotice,
	companionLoggedCopy,
	formatCompanionRatingLabel,
} from "./logged-notice";
import {
	dismissToastHostById,
	mountToastHost,
	releaseToastHost,
} from "./toast-host";

const TOAST_ID = "sense-companion-toast";

/** Match Sense compact log rating: shell track, tinted fill, accent thumb + score. */
const TOAST_STYLE = `
:host {
	all: initial;
	position: fixed;
	right: 16px;
	z-index: 2147483646;
	pointer-events: none;
}
.card {
	pointer-events: auto;
	width: min(20rem, calc(100vw - 32px));
	margin: 0;
	padding: 14px;
	border-radius: 18px;
	background: #141414;
	box-shadow: none;
	color: #f4f1ea;
	font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.3;
	letter-spacing: 0;
	-webkit-font-smoothing: antialiased;
	animation: sense-logged-in 200ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.card.leaving {
	animation: sense-logged-out 200ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.head {
	display: flex;
	align-items: center;
	gap: 8px;
}
.head span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.mark {
	flex: none;
	width: 16px;
	height: 16px;
	color: #3dcc7a;
}
.ask {
	margin: 10px 0 0;
	color: #a39b90;
	font-size: 13px;
	font-weight: 500;
}
.rating-wrap {
	margin-top: 10px;
	touch-action: none;
}
.rating-track {
	position: relative;
	display: block;
	height: 40px;
	border-radius: 12px;
	background: #1a1a1a;
	box-shadow:
		0 1px 2px rgba(0, 0, 0, 0.2),
		0 0 0 1px rgba(255, 255, 255, 0.06);
	cursor: grab;
	overflow: hidden;
	outline: none;
	-webkit-tap-highlight-color: transparent;
	user-select: none;
}
.rating-track:focus-visible {
	box-shadow:
		0 1px 2px rgba(0, 0, 0, 0.2),
		0 0 0 2px rgba(244, 241, 234, 0.35);
}
.rating-track.is-dragging {
	cursor: grabbing;
}
.rating-fill,
.rating-tail,
.rating-thumb {
	position: absolute;
	inset-block: 0;
	pointer-events: none;
}
.rating-fill {
	left: 0;
	z-index: 2;
	background: linear-gradient(
		90deg,
		rgba(232, 168, 84, 0.22) 0%,
		rgba(232, 168, 84, 0.38) 100%
	);
}
.rating-tail {
	right: 0;
	z-index: 1;
	background: #121212;
}
.rating-thumb {
	z-index: 4;
	top: 6px;
	bottom: 6px;
	width: 4px;
	height: auto;
	border-radius: 999px;
	background: #e8a854;
	box-shadow: 0 0 0 2px #1a1a1a;
	transform: translateX(-50%);
}
.rating-score {
	position: absolute;
	inset-block: 0;
	right: 10px;
	z-index: 10;
	display: flex;
	align-items: center;
	font-size: 13px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	letter-spacing: -0.02em;
	color: #e8a854;
	pointer-events: none;
}
.rating-score.is-placeholder {
	color: #7a736a;
	font-weight: 500;
}
.rating-track.is-settled .rating-fill,
.rating-track.is-settled .rating-tail,
.rating-track.is-settled .rating-thumb {
	transition:
		width 220ms cubic-bezier(0.19, 1, 0.22, 1),
		left 220ms cubic-bezier(0.19, 1, 0.22, 1);
}
.actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 12px;
}
button {
	margin: 0;
	padding: 8px 14px;
	border: 0;
	border-radius: 999px;
	background: #1c1c1c;
	color: #f4f1ea;
	font: inherit;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
}
button.primary {
	background: #f4f1ea;
	color: #141414;
}
button.quiet {
	background: transparent;
	color: #a39b90;
	font-weight: 500;
}
button:disabled {
	opacity: 0.45;
	cursor: default;
}
@keyframes sense-logged-in {
	from { opacity: 0; transform: translateX(12px) scale(0.96); }
	to { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes sense-logged-out {
	from { opacity: 1; transform: translateX(0) scale(1); }
	to { opacity: 0; transform: translateX(calc(100% + 24px)) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
	.card, .card.leaving {
		animation: sense-logged-fade 160ms ease both;
	}
	.card.leaving { animation-name: sense-logged-fade-out; }
	.rating-track.is-settled .rating-fill,
	.rating-track.is-settled .rating-tail,
	.rating-track.is-settled .rating-thumb {
		transition: none;
	}
}
@keyframes sense-logged-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sense-logged-fade-out { from { opacity: 1; } to { opacity: 0; } }
`;

function clampRating(display: number): number {
	if (!Number.isFinite(display)) return 0;
	return Math.min(10, Math.max(0, Math.round(display * 10) / 10));
}

function ratingFromClientX(rect: DOMRect, clientX: number): number {
	if (rect.width <= 0) return 0;
	const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
	return clampRating(ratio * 10);
}

function checkSvg(): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "mark");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", "currentColor");
	path.setAttribute("stroke-width", "2");
	path.setAttribute("stroke-linecap", "round");
	path.setAttribute("stroke-linejoin", "round");
	path.setAttribute("d", "M3.5 8.5 6.5 11.5 12.5 4.5");
	svg.append(path);
	return svg;
}

/** Compact Sense-style track (fill + thumb + in-track score), not a native range input. */
function mountRatingSlider(askId: string): {
	root: HTMLElement;
	getValue: () => number;
	hasValue: () => boolean;
	onChange: (listener: () => void) => void;
} {
	let value = 0;
	let touched = false;
	let dragging = false;
	const listeners = new Set<() => void>();

	const wrap = document.createElement("div");
	wrap.className = "rating-wrap";

	const track = document.createElement("div");
	track.className = "rating-track is-settled";
	track.setAttribute("role", "slider");
	track.tabIndex = 0;
	track.setAttribute("aria-labelledby", askId);
	track.setAttribute("aria-valuemin", "0");
	track.setAttribute("aria-valuemax", "10");
	track.setAttribute("aria-valuenow", "0");
	track.setAttribute("aria-valuetext", "Not rated");

	const fill = document.createElement("span");
	fill.className = "rating-fill";
	const tail = document.createElement("span");
	tail.className = "rating-tail";
	const thumb = document.createElement("span");
	thumb.className = "rating-thumb";
	const score = document.createElement("span");
	score.className = "rating-score is-placeholder";
	score.textContent = "Rate";

	track.append(fill, tail, thumb, score);
	wrap.append(track);

	const sync = () => {
		const pct = `${(value / 10) * 100}%`;
		fill.style.width = pct;
		tail.style.left = pct;
		thumb.style.left = pct;
		track.setAttribute("aria-valuenow", String(value));
		if (!touched) {
			score.textContent = "Rate";
			score.classList.add("is-placeholder");
			track.setAttribute("aria-valuetext", "Not rated");
			return;
		}
		const label = formatCompanionRatingLabel(value);
		score.textContent = label;
		score.classList.remove("is-placeholder");
		track.setAttribute("aria-valuetext", `${label} out of 10`);
	};

	const setValue = (next: number, fromUser: boolean) => {
		const clamped = clampRating(next);
		if (fromUser) touched = true;
		value = clamped;
		sync();
		if (fromUser) {
			for (const listener of listeners) listener();
		}
	};

	const setDragging = (next: boolean) => {
		dragging = next;
		track.classList.toggle("is-dragging", next);
		track.classList.toggle("is-settled", !next);
	};

	let dragRect: DOMRect | null = null;

	const onPointerDown = (event: PointerEvent) => {
		dragRect = track.getBoundingClientRect();
		setDragging(true);
		document.body.style.cursor = "grabbing";
		track.setPointerCapture(event.pointerId);
		setValue(ratingFromClientX(dragRect, event.clientX), true);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!dragging || !dragRect) return;
		setValue(ratingFromClientX(dragRect, event.clientX), true);
	};

	const finishDrag = (pointerId: number) => {
		if (!dragging) return;
		try {
			track.releasePointerCapture(pointerId);
		} catch {
			// Pointer already released.
		}
		setDragging(false);
		document.body.style.cursor = "";
		dragRect = null;
	};

	track.addEventListener("pointerdown", onPointerDown);
	track.addEventListener("pointermove", onPointerMove);
	track.addEventListener("pointerup", (event) => finishDrag(event.pointerId));
	track.addEventListener("pointercancel", (event) =>
		finishDrag(event.pointerId),
	);

	track.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			setValue(touched ? value - 0.1 : 0, true);
		}
		if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			setValue(touched ? value + 0.1 : 0.1, true);
		}
	});

	sync();

	return {
		root: wrap,
		getValue: () => value,
		hasValue: () => touched,
		onChange: (listener) => {
			listeners.add(listener);
		},
	};
}

/**
 * Stays on the right until the patron rates the log or dismisses it.
 * The playback toast slides away on its own; this one has to be clicked.
 */
export function showLoggedToast(
	notice: CompanionLoggedNotice,
	onRate: (rating: number) => Promise<boolean>,
): void {
	dismissToastHostById(TOAST_ID);
	const copy = companionLoggedCopy(notice);
	const host = document.createElement("div");
	host.id = TOAST_ID;
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = TOAST_STYLE;

	const card = document.createElement("div");
	card.className = "card";
	card.setAttribute("role", "dialog");
	card.setAttribute("aria-label", `${copy}. How was it?`);

	const head = document.createElement("div");
	head.className = "head";
	const label = document.createElement("span");
	label.textContent = copy;
	head.append(checkSvg(), label);

	const ask = document.createElement("p");
	ask.className = "ask";
	ask.id = "sense-logged-ask";
	ask.textContent = "How was it?";

	const slider = mountRatingSlider(ask.id);

	const actions = document.createElement("div");
	actions.className = "actions";
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.className = "quiet";
	dismiss.textContent = "Not now";
	const save = document.createElement("button");
	save.type = "button";
	save.className = "primary";
	save.textContent = "Save rating";
	save.disabled = true;
	actions.append(dismiss, save);

	card.append(head, ask, slider.root, actions);
	shadow.append(style, card);
	mountToastHost(host);

	let closed = false;

	const close = () => {
		if (closed) return;
		closed = true;
		document.removeEventListener("keydown", onKey);
		document.removeEventListener("pointerdown", onOutside);
		card.classList.add("leaving");
		card.addEventListener("animationend", () => releaseToastHost(host), {
			once: true,
		});
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key === "Escape") close();
	};
	const onOutside = (event: Event) => {
		const path = event.composedPath();
		if (path.includes(host) || path.includes(card)) return;
		close();
	};

	slider.onChange(() => {
		save.disabled = !slider.hasValue();
	});
	dismiss.addEventListener("click", close);
	save.addEventListener("click", () => {
		if (!slider.hasValue() || closed) return;
		const rating = slider.getValue();
		save.disabled = true;
		dismiss.disabled = true;
		void onRate(rating).then((ok) => {
			if (closed) return;
			if (!ok) {
				ask.textContent = "Could not save the rating.";
				save.disabled = false;
				dismiss.disabled = false;
				return;
			}
			ask.textContent = `Rated ${formatCompanionRatingLabel(rating)}`;
			slider.root.remove();
			actions.remove();
			window.setTimeout(close, 900);
		});
	});

	document.addEventListener("keydown", onKey);
	window.setTimeout(() => {
		document.addEventListener("pointerdown", onOutside);
	}, 0);
}
