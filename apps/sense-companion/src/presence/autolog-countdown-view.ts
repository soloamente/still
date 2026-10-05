import {
	type AutologCountdownPhase,
	autologRingProgress,
	formatAutologClock,
	formatAutologMinutes,
} from "./autolog-countdown";
import {
	dismissToastHostById,
	mountToastHost,
	releaseToastHost,
	scheduleLayoutToastStack,
} from "./toast-host";

/** Visible lead on the sentence phase. */
const AUTO_LOG_LEAD = "Auto Log in...";
/** Spoken label without the decorative ellipsis. */
const AUTO_LOG_SPOKEN = "Auto Log in";

const HOST_ID = "sense-companion-autolog-toast";

/** Hourglass body. The fill follows the icon color. */
const HOURGLASS_PATH =
	"m4.502,3.0625l.1499,2.3984c.0811,1.291.6489,2.4849,1.5991,3.3623l1.2749,1.1768-1.2749,1.1768c-.9502.8774-1.5181,2.0713-1.5991,3.3623l-.1499,2.3984c-.0013.0214.0089.0411.0089.0625h10.9783c0-.0214.0103-.0411.0089-.0625l-.1499-2.3984c-.0811-1.291-.6489-2.4849-1.5991-3.3623l-1.2749-1.1768,1.2749-1.1768c.9502-.8774,1.5181-2.0713,1.5991-3.3623l.1499-2.3984c.0013-.0214-.0089-.0411-.0089-.0625H4.5109c0,.0214-.0103.0411-.0089.0625Zm5.2095,9.4951c.1846-.0771.3926-.0771.5771,0,1.1963.4985,2.0093,1.3179,2.416,2.436.084.23.0503.4863-.0903.6865-.1401.2007-.3696.3198-.6143.3198h-4c-.2446,0-.4741-.1191-.6143-.3198-.1406-.2002-.1743-.4565-.0903-.6865.4067-1.1182,1.2197-1.9375,2.416-2.436Z";

/**
 * Top/right on the host are set by toast-host stacking. Width morph uses
 * transitions.dev card resize. Targets are measured, so the open pill is
 * never shorter than its text.
 */
const PILL_STYLE = `
:host {
	all: initial;
	display: block;
	position: fixed;
	right: 16px;
	z-index: 2147483646;
	box-sizing: border-box;
	width: max-content;
	max-width: min(24rem, calc(100vw - 32px));
	overflow: visible;
	pointer-events: none;
	/* Shadow tree: page :root tokens do not apply here. */
	--resize-dur: 300ms;
	--resize-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
.t-resize {
	transition:
		width  var(--resize-dur) var(--resize-ease),
		height var(--resize-dur) var(--resize-ease);
	will-change: width, height;
}
.shell {
	--progress: 0;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	flex-wrap: nowrap;
	position: relative;
	width: max-content;
	max-width: min(24rem, calc(100vw - 32px));
	margin: 0;
	padding: 10px 14px 10px 10px;
	border-radius: 999px;
	background: #2e2e30;
	box-shadow: none;
	color: #fff;
	font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.35;
	letter-spacing: -0.01em;
	font-variant-numeric: tabular-nums;
	-webkit-font-smoothing: antialiased;
	overflow: hidden;
	/* The host ignores hits so the page stays clickable. The pill itself can. */
	pointer-events: auto;
	cursor: default;
	user-select: none;
	outline: none;
}
/* 2px ring. Empty at 0, full at 1, starting from 0deg. */
.shell::after {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: inherit;
	padding: 2px;
	background: conic-gradient(
		from 0deg,
		#e8a854 calc(var(--progress) * 1turn),
		transparent calc(var(--progress) * 1turn)
	);
	pointer-events: none;
	mask:
		linear-gradient(#fff 0 0) content-box,
		linear-gradient(#fff 0 0);
	mask-composite: exclude;
	-webkit-mask:
		linear-gradient(#fff 0 0) content-box,
		linear-gradient(#fff 0 0);
	-webkit-mask-composite: xor;
}
.icon,
.words,
.badge,
.clock {
	flex: none;
	flex-shrink: 0;
	white-space: nowrap;
}
.icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	margin-right: 8px;
	color: #e8a854;
}
.icon svg {
	display: block;
	width: 20px;
	height: 20px;
}
.words {
	margin-right: 8px;
}
.badge {
	padding: 4px 8px;
	border-radius: 999px;
	background: #3a3a3c;
	color: #fff;
	font-size: 13px;
	font-weight: 600;
}
/* Clock-only has no icon, so the left inset matches the right. */
.shell.clock:not(.explain) {
	padding-left: 14px;
}
/* Compact clock: timer only — no animated max-width (that clipped the lead on hover). */
.shell.clock:not(.explain) .icon,
.shell.clock:not(.explain) .words,
.shell.clock:not(.explain) .badge {
	display: none;
}
.shell.sentence .clock,
.shell.clock.explain .clock {
	display: none;
}
.shell.clock:not(.explain) .clock {
	display: block;
}
@media (prefers-reduced-motion: reduce) {
	.t-resize { transition: none !important; }
}
`;

type CountdownPill = {
	host: HTMLDivElement;
	shell: HTMLDivElement;
	badge: HTMLSpanElement;
	clock: HTMLSpanElement;
};

/** Kept for the life of the content script so later syncs update this host. */
let pill: CountdownPill | null = null;
/** After the pointer leaves the clock, keep the full sentence this long. */
const EXPLAIN_AFTER_LEAVE_MS = 1200;
let explainTimer: number | null = null;

function hourglassSvg(): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 20 20");
	svg.setAttribute("width", "20");
	svg.setAttribute("height", "20");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute("d", HOURGLASS_PATH);
	const topCap = document.createElementNS("http://www.w3.org/2000/svg", "line");
	topCap.setAttribute("x1", "4");
	topCap.setAttribute("y1", "3");
	topCap.setAttribute("x2", "16");
	topCap.setAttribute("y2", "3");
	const bottomCap = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"line",
	);
	bottomCap.setAttribute("x1", "4");
	bottomCap.setAttribute("y1", "17");
	bottomCap.setAttribute("x2", "16");
	bottomCap.setAttribute("y2", "17");
	for (const cap of [topCap, bottomCap]) {
		cap.setAttribute("stroke", "#e8a854");
		cap.setAttribute("stroke-width", "2");
		cap.setAttribute("stroke-linecap", "round");
		cap.setAttribute("fill", "none");
	}
	svg.append(path, topCap, bottomCap);
	return svg;
}

/** Accessible name for the two visible phases. */
function spokenLabel(
	phase: Exclude<AutologCountdownPhase, "hidden">,
	remainingSec: number,
	explaining: boolean,
): string {
	if (explaining || phase === "sentence") {
		return `${AUTO_LOG_SPOKEN}. ${formatAutologMinutes(remainingSec)}.`;
	}
	switch (phase) {
		case "clock":
			return `${formatAutologClock(remainingSec)} left to log.`;
		default: {
			const unreachable: never = phase;
			return unreachable;
		}
	}
}

function clearExplainTimer(): void {
	if (explainTimer == null) return;
	window.clearTimeout(explainTimer);
	explainTimer = null;
}

/**
 * Tween the pill width to the visible content.
 * Padding snaps with the state change first, then `.t-resize` eases width
 * so the inset does not trail the open or close.
 */
function tweenShellToContent(shell: HTMLElement): void {
	const from = Math.ceil(shell.getBoundingClientRect().width);
	shell.style.transition = "none";
	shell.style.width = "max-content";
	const to = Math.ceil(shell.getBoundingClientRect().width);
	if (to <= 0) {
		shell.style.removeProperty("width");
		shell.style.removeProperty("transition");
		scheduleLayoutToastStack();
		return;
	}
	const reduce =
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduce || from <= 0 || from === to) {
		shell.style.width = `${to}px`;
		shell.style.removeProperty("transition");
		scheduleLayoutToastStack();
		return;
	}
	shell.style.width = `${from}px`;
	void shell.offsetWidth;
	shell.style.removeProperty("transition");
	void shell.offsetWidth;
	shell.style.width = `${to}px`;
	scheduleLayoutToastStack();
}

function labelFromShell(shell: HTMLElement): void {
	const minutes = shell.querySelector(".badge")?.textContent ?? "";
	const clock = shell.querySelector(".clock")?.textContent ?? "";
	const explaining =
		shell.classList.contains("explain") || shell.classList.contains("sentence");
	shell.setAttribute(
		"aria-label",
		explaining ? `${AUTO_LOG_SPOKEN}. ${minutes}.` : `${clock} left to log.`,
	);
}

/** Open the sentence on the clock so the hourglass and minutes are visible. */
function showExplain(shell: HTMLElement): void {
	if (!shell.classList.contains("clock")) return;
	clearExplainTimer();
	shell.classList.add("explain");
	labelFromShell(shell);
	tweenShellToContent(shell);
}

/** Fold back to the clock after the pointer has been gone a moment. */
function scheduleHideExplain(shell: HTMLElement): void {
	clearExplainTimer();
	explainTimer = window.setTimeout(() => {
		explainTimer = null;
		shell.classList.remove("explain");
		labelFromShell(shell);
		tweenShellToContent(shell);
	}, EXPLAIN_AFTER_LEAVE_MS);
}

function hideExplain(shell: HTMLElement): void {
	clearExplainTimer();
	shell.classList.remove("explain");
	labelFromShell(shell);
	tweenShellToContent(shell);
}

function mountPill(): CountdownPill {
	dismissToastHostById(HOST_ID);
	const host = document.createElement("div");
	host.id = HOST_ID;
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = PILL_STYLE;
	const shell = document.createElement("div");
	shell.className = "shell t-resize sentence";
	shell.setAttribute("role", "status");
	shell.tabIndex = 0;
	let pointerKind = "mouse";
	shell.addEventListener("pointerdown", (event) => {
		pointerKind = event.pointerType;
	});
	shell.addEventListener("pointerenter", (event) => {
		if (event.pointerType === "touch") return;
		showExplain(shell);
	});
	shell.addEventListener("pointerleave", (event) => {
		if (event.pointerType === "touch") return;
		scheduleHideExplain(shell);
	});
	shell.addEventListener("focus", () => {
		showExplain(shell);
	});
	shell.addEventListener("blur", () => {
		scheduleHideExplain(shell);
	});
	shell.addEventListener("click", () => {
		if (pointerKind !== "touch") return;
		if (!shell.classList.contains("clock")) return;
		if (shell.classList.contains("explain")) {
			hideExplain(shell);
			return;
		}
		showExplain(shell);
	});
	const icon = document.createElement("span");
	icon.className = "icon";
	icon.setAttribute("aria-hidden", "true");
	icon.append(hourglassSvg());
	const words = document.createElement("span");
	words.className = "words";
	words.setAttribute("aria-hidden", "true");
	words.textContent = AUTO_LOG_LEAD;
	const badge = document.createElement("span");
	badge.className = "badge";
	badge.setAttribute("aria-hidden", "true");
	const clock = document.createElement("span");
	clock.className = "clock";
	clock.setAttribute("aria-hidden", "true");
	shell.append(icon, words, badge, clock);
	shadow.append(style, shell);
	mountToastHost(host);
	return { host, shell, badge, clock };
}

function ensurePill(): CountdownPill {
	if (pill?.host.isConnected) return pill;
	pill = mountPill();
	return pill;
}

/** Phase hidden, or a caller with no remaining time, takes the host away. */
function removePill(): void {
	if (pill?.host.isConnected) releaseToastHost(pill.host);
	pill = null;
}

function paintPill(
	nodes: CountdownPill,
	phase: Exclude<AutologCountdownPhase, "hidden">,
	remainingSec: number,
): void {
	nodes.badge.textContent = formatAutologMinutes(remainingSec);
	nodes.clock.textContent = formatAutologClock(remainingSec);
	nodes.shell.style.setProperty(
		"--progress",
		String(autologRingProgress(remainingSec)),
	);
	nodes.shell.classList.toggle("sentence", phase === "sentence");
	nodes.shell.classList.toggle("clock", phase === "clock");
	if (phase === "sentence") {
		clearExplainTimer();
		nodes.shell.classList.remove("explain");
	}
	nodes.shell.setAttribute(
		"aria-label",
		spokenLabel(phase, remainingSec, nodes.shell.classList.contains("explain")),
	);
	tweenShellToContent(nodes.shell);
}

/**
 * Draws the auto-log countdown. The host is created once and updated in
 * place. It stays until phase is "hidden" — no hover timer, no auto-dismiss.
 */
export function syncAutologCountdownPill(input: {
	phase: AutologCountdownPhase;
	remainingSec: number | null;
}): void {
	switch (input.phase) {
		case "hidden":
			removePill();
			return;
		case "sentence":
		case "clock": {
			if (input.remainingSec == null) {
				removePill();
				return;
			}
			paintPill(ensurePill(), input.phase, input.remainingSec);
			return;
		}
		default: {
			const unreachable: never = input.phase;
			throw new Error(`Unknown countdown phase: ${unreachable}`);
		}
	}
}
