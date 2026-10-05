/**
 * Fullscreen paints only the element that requested it, and its descendants.
 * A toast on <html> sits outside that box, so the player covers it.
 */

import {
	computeToastStackTops,
	TOAST_SLOT_HOST_ID,
	type ToastStackSlot,
} from "./toast-stack";

const HOST_MARK = "data-sense-toast-host";

type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null;
};

/** Player box while fullscreen, otherwise the page root. */
export function toastMountParent(
	fullscreen: Element | null,
	pageRoot: Element,
): Element {
	return fullscreen ?? pageRoot;
}

function pageRoot(): Element {
	return document.documentElement ?? document.body;
}

function activeFullscreenElement(): Element | null {
	const doc = document as FullscreenDocument;
	return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

const hosts = new Set<HTMLElement>();
let watching = false;
let layoutFrame: number | null = null;
let resizeObserver: ResizeObserver | null = null;

function pruneHosts(): void {
	for (const host of [...hosts]) {
		if (!host.isConnected) {
			hosts.delete(host);
			resizeObserver?.unobserve(host);
		}
	}
}

function slotForHost(host: HTMLElement): ToastStackSlot | null {
	switch (host.id) {
		case TOAST_SLOT_HOST_ID.playback:
			return "playback";
		case TOAST_SLOT_HOST_ID.countdown:
			return "countdown";
		default:
			return null;
	}
}

function stackMotionTransition(): string {
	if (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		return "none";
	}
	return "top 220ms cubic-bezier(0.19, 1, 0.22, 1)";
}

/** Stack playback above countdown; animate `top` when a row appears or leaves. */
export function layoutToastStack(): void {
	pruneHosts();
	const visible: Record<ToastStackSlot, boolean> = {
		playback: false,
		countdown: false,
	};
	const heights: Record<ToastStackSlot, number> = {
		playback: 0,
		countdown: 0,
	};
	const hostBySlot: Partial<Record<ToastStackSlot, HTMLElement>> = {};
	for (const host of hosts) {
		if (!host.isConnected) continue;
		const slot = slotForHost(host);
		if (!slot) continue;
		visible[slot] = true;
		heights[slot] = host.getBoundingClientRect().height;
		hostBySlot[slot] = host;
	}
	const tops = computeToastStackTops({ visible, heights });
	const transition = stackMotionTransition();
	for (const slot of ["playback", "countdown"] as const) {
		const host = hostBySlot[slot];
		if (!host) continue;
		const top = tops[slot];
		if (top == null) continue;
		host.style.position = "fixed";
		host.style.right = "16px";
		host.style.zIndex = "2147483646";
		host.style.transition = transition;
		host.style.top = `${top}px`;
	}
}

/** Relayout when a toast changes height or width (e.g. countdown hover expand). */
export function scheduleLayoutToastStack(): void {
	if (layoutFrame != null) {
		cancelAnimationFrame(layoutFrame);
	}
	layoutFrame = requestAnimationFrame(() => {
		layoutFrame = null;
		layoutToastStack();
		// First paint can report zero height before the shadow shell lays out.
		requestAnimationFrame(() => layoutToastStack());
	});
}

function ensureResizeObserver(): ResizeObserver {
	if (resizeObserver != null) return resizeObserver;
	resizeObserver = new ResizeObserver(() => scheduleLayoutToastStack());
	return resizeObserver;
}

/** Keep every live toast inside the current top layer. */
function parkToastHosts(): void {
	pruneHosts();
	const parent = toastMountParent(activeFullscreenElement(), pageRoot());
	for (const host of hosts) {
		if (host.parentElement !== parent) parent.append(host);
	}
	scheduleLayoutToastStack();
}

function watchFullscreen(): void {
	if (watching) return;
	watching = true;
	document.addEventListener("fullscreenchange", parkToastHosts, true);
	document.addEventListener("webkitfullscreenchange", parkToastHosts, true);
}

/** Drop a notice and relayout so rows below slide back up. */
export function releaseToastHost(host: HTMLElement): void {
	hosts.delete(host);
	resizeObserver?.unobserve(host);
	host.remove();
	scheduleLayoutToastStack();
}

/** Remove a notice by id when swapping in a new one with the same slot. */
export function dismissToastHostById(id: string): void {
	const el = document.getElementById(id);
	if (!(el instanceof HTMLElement)) return;
	if (hosts.has(el)) {
		releaseToastHost(el);
		return;
	}
	el.remove();
}

/** Attach a toast where fullscreen can still show it. */
export function mountToastHost(host: HTMLElement): void {
	host.setAttribute(HOST_MARK, "");
	pruneHosts();
	for (const existing of [...hosts]) {
		if (
			existing.id.length > 0 &&
			existing.id === host.id &&
			existing !== host
		) {
			releaseToastHost(existing);
		}
	}
	hosts.add(host);
	toastMountParent(activeFullscreenElement(), pageRoot()).append(host);
	ensureResizeObserver().observe(host);
	watchFullscreen();
	scheduleLayoutToastStack();
}
