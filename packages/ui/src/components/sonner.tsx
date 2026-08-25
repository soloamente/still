"use client";

import {
	InfoIcon,
	Loader2Icon,
	Pencil,
	Plus,
	TriangleAlertIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import IconCircleXmarkFill from "../icons/circle-xmark-fill";
import { cn } from "../lib/utils";

/** Shared leading-well size — 28px circle; grid centers Lucide glyphs optically. */
const toastIconCircleClass =
	"inline-grid size-7 shrink-0 place-items-center rounded-full leading-none";

/** Leading marks for narrative toasts — semantic wells on the themed card pill. */
export const stillToastLeadingIcons = {
	added: (
		<span className={cn(toastIconCircleClass, "bg-emerald-500/90 text-white")}>
			<Plus className="block size-4 shrink-0" strokeWidth={2.5} aria-hidden />
		</span>
	),
	updated: (
		<span className={cn(toastIconCircleClass, "bg-sky-500/90 text-white")}>
			<Pencil className="size-3.5" strokeWidth={2.5} aria-hidden />
		</span>
	),
	info: (
		<span
			className={cn(toastIconCircleClass, "bg-muted text-muted-foreground")}
		>
			<InfoIcon className="size-4" aria-hidden />
		</span>
	),
	warning: (
		<span
			className={cn(
				toastIconCircleClass,
				"bg-amber-500/20 text-amber-600 dark:text-amber-400",
			)}
		>
			<TriangleAlertIcon className="size-4" aria-hidden />
		</span>
	),
	/** Bare red circle-X — no tinted pill well behind the glyph. */
	error: (
		<span
			className="inline-flex size-5 shrink-0 items-center justify-center text-destructive"
			aria-hidden
		>
			<IconCircleXmarkFill className="size-5" />
		</span>
	),
	loading: (
		<span
			className={cn(toastIconCircleClass, "bg-muted text-muted-foreground")}
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
		"border border-border/80 bg-card text-card-foreground shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--foreground)_18%,transparent)]",
		"w-max max-w-[min(420px,calc(100vw-32px))] rounded-full py-2.5 pr-3.5 pl-2.5",
		"select-none font-sans text-[13px] leading-snug tracking-normal",
		"[&:focus-visible]:shadow-[0_12px_40px_-12px_color-mix(in_oklab,var(--foreground)_18%,transparent),0_0_0_2px_color-mix(in_oklab,var(--foreground)_12%,transparent)]",
	),
	content: "!flex !flex-col !gap-0",
	title:
		"!font-normal !leading-snug !text-inherit [&:empty]:min-h-0 [&:empty]:hidden",
	description:
		"!mt-0.5 !text-[13px] !font-normal !leading-snug !text-muted-foreground",
	icon: "!m-0 !flex !size-7 !shrink-0 !items-center !justify-center !self-center [&>span]:!grid [&>span]:!size-7 [&>span]:!place-items-center",
	closeButton:
		"border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
	success: "!border-0 !bg-card !text-card-foreground",
	error: "!border-0 !bg-card !text-destructive",
	info: "!border-0 !bg-card !text-card-foreground",
	warning: "!border-0 !bg-card !text-card-foreground",
	loading: "!border-0 !bg-card !text-card-foreground",
	default: "!border-0 !bg-card !text-card-foreground",
};

/**
 * Sonner Toaster tuned for Still — theme-token pill (`bg-card`) over the shell,
 * action-specific leading marks, bottom-center placement. Beam chrome lives in
 * apps/web (`StillToastBeamFrame` via toast method patch).
 */
const Toaster = ({
	className,
	position = "bottom-center",
	richColors = false,
	theme = "system",
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
		"--normal-bg": "var(--card)",
		"--normal-text": "var(--card-foreground)",
		"--normal-border": "color-mix(in oklab, var(--border) 80%, transparent)",
		"--success-bg": "var(--card)",
		"--success-text": "var(--card-foreground)",
		"--success-border": "color-mix(in oklab, var(--border) 80%, transparent)",
		"--error-bg": "var(--card)",
		"--error-text": "var(--destructive)",
		"--error-border": "color-mix(in oklab, var(--border) 80%, transparent)",
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
