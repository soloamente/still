"use client";

import { createElement, type ReactNode } from "react";
import { type ExternalToast, toast as sonnerToast } from "sonner";

import {
	StillToastBeamFrame,
	type StillToastBeamType,
} from "@/components/app/still-toast-beam-frame";

type TitleT = (() => ReactNode) | ReactNode;

let patched = false;

function resolveNode(message: TitleT): ReactNode {
	return typeof message === "function" ? message() : message;
}

/**
 * Sonner options for beam toasts. Drop `icon` — StillToastBeamFrame already
 * paints the leading mark; leaving it here duplicates the glyph in `[data-icon]`.
 */
export function beamToastSonnerOptions(data?: ExternalToast): ExternalToast {
	const { icon: _icon, className, ...rest } = data ?? {};
	return {
		...rest,
		// Let the BorderBeam shell own chrome — Sonner’s pill must stay transparent.
		unstyled: true,
		className: [
			"still-toast-beam-host",
			"!bg-transparent !border-0 !shadow-none !p-0",
			className,
		]
			.filter(Boolean)
			.join(" "),
	};
}

function showBeamToast(
	type: StillToastBeamType,
	message: TitleT,
	data?: ExternalToast,
) {
	const title = resolveNode(message);
	const description = data?.description
		? resolveNode(data.description as TitleT)
		: undefined;

	return sonnerToast.custom(
		() =>
			createElement(StillToastBeamFrame, {
				type,
				title,
				description,
				icon: data?.icon,
			}),
		beamToastSonnerOptions(data),
	);
}

/**
 * Rewire `toast.success|error|…` onto BorderBeam rotate+hue-pulse shells.
 * Call once from Providers — patches the sonner singleton so existing
 * `import { toast } from "sonner"` call sites pick this up.
 */
export function installStillToastBeamPatch(): void {
	if (patched || typeof window === "undefined") return;
	patched = true;

	sonnerToast.success = (message, data) =>
		showBeamToast("success", message, data);
	sonnerToast.error = (message, data) => showBeamToast("error", message, data);
	sonnerToast.warning = (message, data) =>
		showBeamToast("warning", message, data);
	sonnerToast.info = (message, data) => showBeamToast("info", message, data);
	sonnerToast.loading = (message, data) =>
		showBeamToast("loading", message, data);
	sonnerToast.message = (message, data) =>
		showBeamToast("default", message, data);
}
