import {
	autologErrorActionHref,
	autologErrorToastCopy,
	type CompanionAutologErrorNotice,
} from "./autolog-error-notice";
import {
	dismissToastHostById,
	mountToastHost,
	releaseToastHost,
} from "./toast-host";

const TOAST_ID = "sense-companion-autolog-error-toast";

/** Nucleo micro bold `circle-xmark-filled` — the Sense error mark. */
const CIRCLE_XMARK_FILLED_PATH =
	"m15.657,4.343c-3.119-3.119-8.195-3.119-11.314,0s-3.119,8.194,0,11.313c1.56,1.56,3.608,2.339,5.657,2.339s4.098-.78,5.657-2.339c3.119-3.119,3.119-8.194,0-11.313Zm-1.95,7.95c.391.391.391,1.023,0,1.414-.195.195-.451.293-.707.293s-.512-.098-.707-.293l-2.293-2.293-2.293,2.293c-.195.195-.451.293-.707.293s-.512-.098-.707-.293c-.391-.391-.391-1.023,0-1.414l2.293-2.293-2.293-2.293c-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0l2.293,2.293,2.293-2.293c.391-.391,1.023-.391,1.414,0s.391,1.023,0,1.414l-2.293,2.293,2.293,2.293Z";
/** Nucleo micro bold `circle-check-filled` for the already-logged skip. */
const CIRCLE_CHECK_FILLED_PATH =
	"m10,2C5.589,2,2,5.589,2,10s3.589,8,8,8,8-3.589,8-8S14.411,2,10,2Zm4.284,5.621l-4.75,6c-.183.231-.458.37-.753.379-.01,0-.021,0-.031,0-.283,0-.554-.12-.743-.331l-2.25-2.5c-.369-.411-.336-1.043.074-1.412.41-.37,1.042-.336,1.412.074l1.458,1.62,4.015-5.071c.343-.432.971-.506,1.405-.164.433.343.506.972.163,1.405Z";

function markPath(variant: "error" | "info"): string {
	switch (variant) {
		case "error":
			return CIRCLE_XMARK_FILLED_PATH;
		case "info":
			return CIRCLE_CHECK_FILLED_PATH;
		default: {
			const unreachable: never = variant;
			return unreachable;
		}
	}
}

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
	color: #f4f1ea;
	font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.35;
	-webkit-font-smoothing: antialiased;
	animation: sense-autolog-error-in 200ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.card.leaving {
	animation: sense-autolog-error-out 200ms cubic-bezier(0.19, 1, 0.22, 1) both;
}
.card.info .mark {
	color: #a39b90;
}
.card.error .mark {
	color: #e5484d;
}
.head {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}
.mark {
	flex: none;
	width: 18px;
	height: 18px;
	margin-top: 1px;
}
.copy {
	min-width: 0;
	flex: 1;
}
.headline {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}
.body {
	margin: 6px 0 0;
	color: #a39b90;
	font-size: 13px;
	font-weight: 500;
}
.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 12px;
}
.btn {
	appearance: none;
	border: none;
	border-radius: 999px;
	padding: 8px 14px;
	font: inherit;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
	user-select: none;
	-webkit-tap-highlight-color: transparent;
}
.btn-primary {
	background: #f4f1ea;
	color: #141414;
}
.btn-quiet {
	background: #2e2e30;
	color: #f4f1ea;
}
@keyframes sense-autolog-error-in {
	from { opacity: 0; transform: translateX(12px); }
	to { opacity: 1; transform: translateX(0); }
}
@keyframes sense-autolog-error-out {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(12px); }
}
`;

const TOAST_HOLD_MS = 8_000;
/** Same pause-after-hover as the playback pill. */
const TOAST_AFTER_HOVER_MS = 1_200;

/** Auto-log catalogue / save failures — Option A copy. */
export function showAutologErrorToast(
	notice: CompanionAutologErrorNotice,
): void {
	const copy = autologErrorToastCopy(notice);
	if (!copy) return;

	dismissToastHostById(TOAST_ID);
	const host = document.createElement("div");
	host.id = TOAST_ID;
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = TOAST_STYLE;

	const card = document.createElement("div");
	card.className = `card ${copy.variant}`;
	card.setAttribute("role", "alert");
	card.setAttribute("aria-label", copy.ariaLabel);

	const head = document.createElement("div");
	head.className = "head";
	const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	mark.setAttribute("class", "mark");
	mark.setAttribute("viewBox", "0 0 20 20");
	mark.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute("d", markPath(copy.variant));
	mark.append(path);

	const text = document.createElement("div");
	text.className = "copy";
	const headline = document.createElement("p");
	headline.className = "headline";
	headline.textContent = copy.headline;
	const body = document.createElement("p");
	body.className = "body";
	body.textContent = copy.body;

	const actions = document.createElement("div");
	actions.className = "actions";
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.className = "btn btn-quiet";
	dismiss.textContent = "Dismiss";
	dismiss.addEventListener("click", () => {
		forceLeave();
	});

	const href = autologErrorActionHref(notice);
	if (copy.actionLabel !== "Dismiss") {
		const open = document.createElement("a");
		open.className = "btn btn-primary";
		open.textContent = copy.actionLabel;
		open.href = href;
		open.target = "_blank";
		open.rel = "noopener noreferrer";
		actions.append(open, dismiss);
	} else {
		actions.append(dismiss);
	}

	// Actions sit in the copy column so they line up with the headline, past the icon.
	text.append(headline, body, actions);
	head.append(mark, text);
	card.append(head);
	shadow.append(style, card);

	let hovered = false;
	let holdDone = false;
	let leaving = false;
	let afterHover: number | null = null;
	const clearAfterHover = () => {
		if (afterHover == null) return;
		window.clearTimeout(afterHover);
		afterHover = null;
	};
	const leave = () => {
		if (leaving || hovered || !holdDone) return;
		leaving = true;
		card.classList.add("leaving");
	};
	const forceLeave = () => {
		hovered = false;
		holdDone = true;
		clearAfterHover();
		leave();
	};
	card.addEventListener("pointerenter", () => {
		hovered = true;
		clearAfterHover();
	});
	card.addEventListener("pointerleave", () => {
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
	card.addEventListener("animationend", (event) => {
		if (event.animationName !== "sense-autolog-error-out") return;
		releaseToastHost(host);
	});

	mountToastHost(host);
}
