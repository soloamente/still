import {
	type AutologCountdownPhase,
	autologRingProgress,
	formatAutologClock,
	formatAutologMinutes,
} from "./autolog-countdown";

const HOST_ID = "sense-companion-autolog-toast";

/** Hourglass body. The fill follows the icon color. */
const HOURGLASS_PATH =
	"m4.502,3.0625l.1499,2.3984c.0811,1.291.6489,2.4849,1.5991,3.3623l1.2749,1.1768-1.2749,1.1768c-.9502.8774-1.5181,2.0713-1.5991,3.3623l-.1499,2.3984c-.0013.0214.0089.0411.0089.0625h10.9783c0-.0214.0103-.0411.0089-.0625l-.1499-2.3984c-.0811-1.291-.6489-2.4849-1.5991-3.3623l-1.2749-1.1768,1.2749-1.1768c.9502-.8774,1.5181-2.0713,1.5991-3.3623l.1499-2.3984c.0013-.0214-.0089-.0411-.0089-.0625H4.5109c0,.0214-.0103.0411-.0089.0625Zm5.2095,9.4951c.1846-.0771.3926-.0771.5771,0,1.1963.4985,2.0093,1.3179,2.416,2.436.084.23.0503.4863-.0903.6865-.1401.2007-.3696.3198-.6143.3198h-4c-.2446,0-.4741-.1191-.6143-.3198-.1406-.2002-.1743-.4565-.0903-.6865.4067-1.1182,1.2197-1.9375,2.416-2.436Z";

/**
 * Sits under the Watching notice (that host is top: 20px).
 * Sentence parts collapse with max-width and opacity; margin and padding
 * travel with them so a closed item does not leave a gap.
 */
const PILL_STYLE = `
:host {
	all: initial;
	position: fixed;
	top: 68px;
	right: 16px;
	z-index: 2147483646;
	pointer-events: none;
}
.shell {
	--progress: 0;
	display: flex;
	align-items: center;
	position: relative;
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
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	opacity: 1;
	transition:
		max-width 220ms,
		opacity 220ms,
		margin-right 220ms,
		padding 220ms;
}
.icon {
	display: flex;
	align-items: center;
	width: 20px;
	height: 20px;
	max-width: 20px;
	margin-right: 8px;
	color: #e8a854;
}
.icon svg {
	display: block;
	width: 20px;
	height: 20px;
}
.words {
	max-width: 8rem;
	margin-right: 8px;
}
.badge {
	max-width: 8rem;
	padding: 4px 8px;
	border-radius: 999px;
	background: #3a3a3c;
	color: #fff;
	font-size: 13px;
}
.clock {
	max-width: 8rem;
}
.shell.clock .icon,
.shell.clock .words,
.shell.clock .badge,
.shell.sentence .clock {
	max-width: 0;
	margin-right: 0;
	padding: 0;
	opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
	.icon,
	.words,
	.badge,
	.clock {
		transition: none;
	}
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
): string {
	switch (phase) {
		case "sentence":
			return `Log in. ${formatAutologMinutes(remainingSec)}.`;
		case "clock":
			return `${formatAutologClock(remainingSec)} left to log.`;
		default: {
			const unreachable: never = phase;
			return unreachable;
		}
	}
}

function mountPill(): CountdownPill {
	document.getElementById(HOST_ID)?.remove();
	const host = document.createElement("div");
	host.id = HOST_ID;
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = PILL_STYLE;
	const shell = document.createElement("div");
	shell.className = "shell sentence";
	shell.setAttribute("role", "status");
	const icon = document.createElement("span");
	icon.className = "icon";
	icon.setAttribute("aria-hidden", "true");
	icon.append(hourglassSvg());
	const words = document.createElement("span");
	words.className = "words";
	words.setAttribute("aria-hidden", "true");
	words.textContent = "Log in";
	const badge = document.createElement("span");
	badge.className = "badge";
	badge.setAttribute("aria-hidden", "true");
	const clock = document.createElement("span");
	clock.className = "clock";
	clock.setAttribute("aria-hidden", "true");
	shell.append(icon, words, badge, clock);
	shadow.append(style, shell);
	(document.documentElement ?? document.body).append(host);
	return { host, shell, badge, clock };
}

function ensurePill(): CountdownPill {
	if (pill?.host.isConnected) return pill;
	pill = mountPill();
	return pill;
}

/** Phase hidden, or a caller with no remaining time, takes the host away. */
function removePill(): void {
	pill?.host.remove();
	pill = null;
	document.getElementById(HOST_ID)?.remove();
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
	nodes.shell.setAttribute("aria-label", spokenLabel(phase, remainingSec));
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
