import { mountToastHost } from "./toast-host";
import type { WatchToastCopy, WatchToastIcon } from "./watch-toast";

const TOAST_ID = "sense-companion-toast";

/** Eye mark on the playback notice. The fill follows the icon color. */
const EYE_PATH =
	"m17.511,8.196c-.877-1.562-3.365-5.196-7.511-5.196s-6.634,3.634-7.496,5.17c-.663,1.103-.668,2.525-.016,3.633.663,1.251,3.107,5.196,7.512,5.196,4.146,0,6.634-3.634,7.496-5.17.668-1.111.668-2.548.015-3.634Zm-7.511,4.804c-1.657,0-3-1.343-3-3s1.343-3,3-3,3,1.343,3,3-1.343,3-3,3Z";
/** Catalogue / home. A circle with a heading mark. */
const EXPLORE_PATH =
	"M1 9.5C1 5.089 4.589 1.5 9 1.5C13.411 1.5 17 5.089 17 9.5C17 13.911 13.411 17.5 9 17.5C4.589 17.5 1 13.911 1 9.5ZM12.9828 6.49142C13.0936 6.21309 13.0282 5.89549 12.8163 5.68365C12.6045 5.47181 12.2869 5.40636 12.0086 5.51718L7.30955 7.38818C7.11809 7.46442 6.96643 7.61608 6.8902 7.80754L5.0192 12.5065C4.90837 12.7849 4.97382 13.1025 5.18566 13.3143C5.39751 13.5262 5.7151 13.5916 5.99344 13.4808L10.6924 11.6098C10.8839 11.5336 11.0356 11.3819 11.1118 11.1904L12.9828 6.49142Z";
/** Title page, before playback. */
const INFO_PATH =
	"m10,2C5.589,2,2,5.589,2,10s3.589,8,8,8,8-3.589,8-8S14.411,2,10,2Zm1,12c0,.552-.447,1-1,1s-1-.448-1-1v-4.5c0-.552.447-1,1-1s1,.448,1,1v4.5Zm-1-6.5c-.689,0-1.25-.561-1.25-1.25s.561-1.25,1.25-1.25,1.25.561,1.25,1.25-.561,1.25-1.25,1.25Z";
/** Resume. */
const PLAY_PATH =
	"m5,5.4826v9.0348c0,1.122,1.198,1.8376,2.1859,1.3056l8.3894-4.5174c1.0398-.5599,1.0398-2.0513,0-2.6112L7.1859,4.177c-.9879-.532-2.1859.1836-2.1859,1.3056Z";

const TOAST_STYLE = `
:host {
	all: initial;
	position: fixed;
	top: 20px;
	right: 16px;
	z-index: 2147483646;
}
.toast {
	display: flex;
	align-items: center;
	gap: 8px;
	max-width: min(24rem, calc(100vw - 32px));
	margin: 0;
	padding: 10px 14px 10px 10px;
	border-radius: 999px;
	background: #2e2e30;
	box-shadow: none;
	color: #fff;
	font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
	font-size: 15px;
	font-weight: 500;
	line-height: 1.35;
	letter-spacing: -0.01em;
	font-variant-numeric: tabular-nums;
	-webkit-font-smoothing: antialiased;
	pointer-events: auto;
	cursor: default;
	/* Arrive, then stay. Leaving is a separate class so hover can hold it. */
	animation: sense-watch-toast-in 220ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.toast.leaving {
	animation: sense-watch-toast-out 280ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.lead,
.title,
.detail {
	line-height: 1.35;
	padding-bottom: 0.12em;
}
.lead,
.title {
	color: #fff;
	font-weight: 600;
}
.lead {
	flex: none;
}
.title {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.detail {
	flex: none;
	color: #9a9a9e;
	font-weight: 500;
}
.mark {
	flex: none;
	width: 24px;
	height: 24px;
	color: #fff;
}
.mark.eye {
	color: #3dcc7a;
}
.mark.eye.error {
	color: #f15b5b;
}
.mark.explore {
	color: #3dccc4;
}
.mark.info {
	color: #c49bff;
}
.mark.pause {
	color: #e8a854;
}
.mark.play {
	color: #5aa2ff;
}
@keyframes sense-watch-toast-in {
	from { opacity: 0; transform: translateX(12px) scale(0.96); }
	to { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes sense-watch-toast-out {
	from { opacity: 1; transform: translateX(0) scale(1); }
	to { opacity: 0; transform: translateX(calc(100% + 24px)) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
	.toast {
		animation: sense-watch-toast-in-still 160ms ease both;
	}
	.toast.leaving {
		animation: sense-watch-toast-out-still 160ms ease both;
	}
}
@keyframes sense-watch-toast-in-still {
	from { opacity: 0; }
	to { opacity: 1; }
}
@keyframes sense-watch-toast-out-still {
	from { opacity: 1; }
	to { opacity: 0; }
}
`;

function markSvg(icon: WatchToastIcon, failed: boolean): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	let markClass: string;
	switch (icon) {
		case "eye":
			markClass = failed ? "mark eye error" : "mark eye";
			break;
		case "explore":
			markClass = "mark explore";
			break;
		case "info":
			markClass = "mark info";
			break;
		case "pause":
			markClass = "mark pause";
			break;
		case "play":
			markClass = "mark play";
			break;
		default: {
			const unreachable: never = icon;
			return unreachable;
		}
	}
	svg.setAttribute("class", markClass);
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("width", "24");
	svg.setAttribute("height", "24");
	switch (icon) {
		case "eye":
			svg.setAttribute("viewBox", "0 0 20 20");
			svg.append(filledPath(EYE_PATH));
			return svg;
		case "explore":
			svg.setAttribute("viewBox", "0 0 18 18");
			svg.append(filledPath(EXPLORE_PATH, true));
			return svg;
		case "info":
			svg.setAttribute("viewBox", "0 0 20 20");
			svg.append(filledPath(INFO_PATH));
			return svg;
		case "play":
			svg.setAttribute("viewBox", "0 0 20 20");
			svg.append(filledPath(PLAY_PATH));
			return svg;
		case "pause":
			svg.setAttribute("viewBox", "0 0 20 20");
			svg.append(pauseBar("4"), pauseBar("12.5"));
			return svg;
		default: {
			const unreachable: never = icon;
			return unreachable;
		}
	}
}

function filledPath(d: string, evenOdd = false): SVGPathElement {
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute("d", d);
	if (evenOdd) path.setAttribute("fill-rule", "evenodd");
	return path;
}

function pauseBar(x: string): SVGRectElement {
	const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	rect.setAttribute("x", x);
	rect.setAttribute("y", "4");
	rect.setAttribute("width", "3.5");
	rect.setAttribute("height", "12");
	rect.setAttribute("rx", "1");
	rect.setAttribute("ry", "1");
	rect.setAttribute("fill", "currentColor");
	return rect;
}

/** How long the pill stays before it can leave. Hover holds it past this. */
const TOAST_HOLD_MS = 2600;
/** After the pointer leaves, wait before sliding away. */
const TOAST_AFTER_HOVER_MS = 1200;

/** Playback-start notice. It stays on the right, then slides off that edge. */
export function showWatchToast(copy: WatchToastCopy, ok: boolean): void {
	document.getElementById(TOAST_ID)?.remove();
	const host = document.createElement("div");
	host.id = TOAST_ID;
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = TOAST_STYLE;
	const row = document.createElement("p");
	row.className = "toast";
	row.setAttribute("role", "status");
	const spoken = [copy.lead, copy.title, copy.detail]
		.filter(Boolean)
		.join(". ");
	row.setAttribute(
		"aria-label",
		ok ? `${spoken}. Sent to Sense.` : `${spoken}. Could not send to Sense.`,
	);
	const watching = document.createElement("span");
	watching.className = "lead";
	watching.textContent = copy.lead;
	const title = document.createElement("span");
	title.className = "title";
	title.textContent = copy.title;
	row.append(markSvg(copy.icon, !ok), watching, title);
	if (copy.detail) {
		const detail = document.createElement("span");
		detail.className = "detail";
		detail.textContent = copy.detail;
		row.append(detail);
	}
	shadow.append(style, row);
	let hovered = false;
	let holdDone = false;
	let leaving = false;
	let afterHover: number | null = null;
	const leave = () => {
		if (leaving || hovered || !holdDone) return;
		leaving = true;
		row.classList.add("leaving");
	};
	const clearAfterHover = () => {
		if (afterHover == null) return;
		window.clearTimeout(afterHover);
		afterHover = null;
	};
	row.addEventListener("pointerenter", () => {
		hovered = true;
		clearAfterHover();
	});
	row.addEventListener("pointerleave", () => {
		hovered = false;
		clearAfterHover();
		afterHover = window.setTimeout(() => {
			afterHover = null;
			leave();
		}, TOAST_AFTER_HOVER_MS);
	});
	window.setTimeout(() => {
		holdDone = true;
		if (!hovered) leave();
	}, TOAST_HOLD_MS);
	row.addEventListener("animationend", (event) => {
		if (
			event.animationName !== "sense-watch-toast-out" &&
			event.animationName !== "sense-watch-toast-out-still"
		) {
			return;
		}
		host.remove();
	});
	mountToastHost(host);
}
