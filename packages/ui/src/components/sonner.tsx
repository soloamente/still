"use client";

import {
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	Pencil,
	Plus,
	TriangleAlertIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "../lib/utils";

/** Shared leading-well size — 28px circle; grid centers Lucide glyphs optically. */
const toastIconCircleClass =
	"inline-grid size-7 shrink-0 place-items-center rounded-full leading-none";

/** Leading marks for narrative toasts — always on a light pill over the dark app shell. */
export const stillToastLeadingIcons = {
	added: (
		<span className={cn(toastIconCircleClass, "bg-sky-400 text-white")}>
			<Plus className="block size-4 shrink-0" strokeWidth={2.5} aria-hidden />
		</span>
	),
	updated: (
		<span className={cn(toastIconCircleClass, "bg-sky-400 text-white")}>
			<Pencil className="size-3.5" strokeWidth={2.5} aria-hidden />
		</span>
	),
	info: (
		<span
			className={cn(toastIconCircleClass, "bg-neutral-200 text-neutral-600")}
		>
			<InfoIcon className="size-4" aria-hidden />
		</span>
	),
	warning: (
		<span className={cn(toastIconCircleClass, "bg-amber-100 text-amber-700")}>
			<TriangleAlertIcon className="size-4" aria-hidden />
		</span>
	),
	error: (
		<span className={cn(toastIconCircleClass, "bg-red-100 text-red-600")}>
			<OctagonXIcon className="size-4" aria-hidden />
		</span>
	),
	loading: (
		<span
			className={cn(toastIconCircleClass, "bg-neutral-100 text-neutral-600")}
		>
			<Loader2Icon className="size-4 animate-spin" aria-hidden />
		</span>
	),
} as const;

const defaultStillToastClassNames: NonNullable<
	ToasterProps["toastOptions"]
>["classNames"] = {
	toast: cn(
		"still-sonner-toast",
		"border border-neutral-200/90 bg-white text-neutral-900 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)]",
		"w-max max-w-[min(420px,calc(100vw-32px))] rounded-full py-2.5 pr-3.5 pl-2.5",
		"select-none font-sans text-[13px] leading-snug tracking-normal",
		"[&:focus-visible]:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18),0_0_0_2px_rgba(0,0,0,0.12)]",
	),
	content: "!flex !flex-col !gap-0",
	title:
		"!font-normal !leading-snug !text-inherit [&:empty]:min-h-0 [&:empty]:hidden",
	description:
		"!mt-0.5 !text-[13px] !font-normal !leading-snug !text-neutral-500",
	icon: "!m-0 !flex !size-7 !shrink-0 !items-center !justify-center !self-center [&>span]:!grid [&>span]:!size-7 [&>span]:!place-items-center",
	closeButton:
		"border-neutral-200/90 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
	success: "!border-0 !bg-white !text-neutral-900",
	error: "!border-0 !bg-white !text-red-600",
	info: "!border-0 !bg-white !text-neutral-900",
	warning: "!border-0 !bg-white !text-neutral-900",
	loading: "!border-0 !bg-white !text-neutral-900",
	default: "!border-0 !bg-white !text-neutral-900",
};

/**
 * Sonner Toaster tuned for Still — **light** pill over the dark shell, action-specific
 * leading marks (plus = added, pencil = updated), bottom-center placement.
 */
const Toaster = ({
	className,
	position = "bottom-center",
	richColors = false,
	theme = "light",
	style,
	toastOptions,
	...props
}: ToasterProps) => {
	const mergedToastOptions: ToasterProps["toastOptions"] = {
		...toastOptions,
		classNames: {
			toast: cn(
				defaultStillToastClassNames.toast,
				toastOptions?.classNames?.toast,
			),
			content: cn(
				defaultStillToastClassNames.content,
				toastOptions?.classNames?.content,
			),
			title: cn(
				defaultStillToastClassNames.title,
				toastOptions?.classNames?.title,
			),
			description: cn(
				defaultStillToastClassNames.description,
				toastOptions?.classNames?.description,
			),
			icon: cn(
				defaultStillToastClassNames.icon,
				toastOptions?.classNames?.icon,
			),
			closeButton: cn(
				defaultStillToastClassNames.closeButton,
				toastOptions?.classNames?.closeButton,
			),
			success: cn(
				defaultStillToastClassNames.success,
				toastOptions?.classNames?.success,
			),
			error: cn(
				defaultStillToastClassNames.error,
				toastOptions?.classNames?.error,
			),
			info: cn(
				defaultStillToastClassNames.info,
				toastOptions?.classNames?.info,
			),
			warning: cn(
				defaultStillToastClassNames.warning,
				toastOptions?.classNames?.warning,
			),
			loading: cn(
				defaultStillToastClassNames.loading,
				toastOptions?.classNames?.loading,
			),
			default: cn(
				defaultStillToastClassNames.default,
				toastOptions?.classNames?.default,
			),
			cancelButton: toastOptions?.classNames?.cancelButton,
			actionButton: toastOptions?.classNames?.actionButton,
			loader: toastOptions?.classNames?.loader,
		},
	};

	const mergedStyle: CSSProperties = {
		"--normal-bg": "#ffffff",
		"--normal-text": "#171717",
		"--normal-border": "rgba(0, 0, 0, 0.08)",
		"--border-radius": "9999px",
		/* Fixed toaster width — Sonner children are `position:absolute`, so `max-content`
		 * collapses the list and breaks `bottom-center` anchoring. Pill width stays on each toast. */
		"--width": "min(420px, calc(100vw - 32px))",
		...style,
	} as CSSProperties;

	return (
		<Sonner
			richColors={richColors}
			theme={theme as ToasterProps["theme"]}
			className={cn("toaster group", className)}
			position={position}
			icons={{
				success: stillToastLeadingIcons.added,
				info: stillToastLeadingIcons.info,
				warning: stillToastLeadingIcons.warning,
				error: stillToastLeadingIcons.error,
				loading: stillToastLeadingIcons.loading,
			}}
			style={mergedStyle}
			toastOptions={mergedToastOptions}
			{...props}
		/>
	);
};

export { Toaster };
