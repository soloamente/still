"use client";

import { cn } from "@still/ui/lib/utils";
import { Liquid, type LiquidItemProps, type LiquidProps } from "liquid-gooey";
import { useTheme } from "next-themes";
import {
	type ComponentPropsWithoutRef,
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/**
 * Move-pill defaults — liquid-gooey SliderThumb demo:
 * `<Liquid blur={9} contrast={40}>` + `move={{ springiness: 0.5, trail: 0.35 }}`
 *
 * Explicitly kill arrival `wobble` — library default 0.5 overshoots size at the
 * end of a slide, which reads as “stuck fat then snap back to pill size”.
 * Keep a light `stretch`/`trail` so the trail still feels rubbery mid-travel.
 */
export const SENSE_LIQUID_BLUR = 9;
export const SENSE_LIQUID_CONTRAST = 40;

/**
 * Move-trail defaults for sliding active pills.
 * `stretch: 0` — size must not inflate with velocity (content-load remasure
 * was leaving a stuck fat blob that then snapped to the real chip width).
 * Trail alone carries the gooey lag on `x`.
 */
export const SENSE_LIQUID_MOVE = {
	springiness: 0.7,
	trail: 0.3,
	stretch: 0,
	wobble: 0,
} as const;

export type SenseLiquidFillRole = "card" | "foreground" | "background";

const FILL_VAR_BY_ROLE: Record<SenseLiquidFillRole, string> = {
	card: "var(--card)",
	foreground: "var(--foreground)",
	background: "var(--background)",
};

const SenseLiquidEnabledContext = createContext(false);

/**
 * Liquid gooey is GPU-filter heavy — skip on reduced motion and software GPUs.
 * SSR / first paint stay disabled until client probes settle (avoids flash).
 */
export function useSenseLiquidEnabled(): boolean {
	const reduceMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		setReady(true);
	}, []);
	return ready && !reduceMotion && !softwareGpu;
}

/**
 * Resolve a theme token to a concrete color for SVG silhouette fills.
 * Raw `var(--card)` often fails inside liquid-gooey's SVG layer and falls back
 * to white — that paints a gooey white blob through active pill labels.
 */
export function resolveSenseLiquidFill(role: SenseLiquidFillRole): string {
	if (typeof document === "undefined") return "transparent";
	const probe = document.createElement("div");
	probe.style.cssText =
		"position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background-color:" +
		FILL_VAR_BY_ROLE[role];
	document.body.appendChild(probe);
	const resolved = getComputedStyle(probe).backgroundColor;
	probe.remove();
	// Guard empty / failed resolution — never hand the lib a broken var.
	if (
		!resolved ||
		resolved === "rgba(0, 0, 0, 0)" ||
		resolved === "transparent"
	) {
		return role === "foreground" ? "rgb(255, 255, 255)" : "rgb(24, 24, 27)";
	}
	return resolved;
}

/** Concrete fill that updates when the app theme class changes. */
export function useSenseLiquidFill(role: SenseLiquidFillRole): string {
	const { resolvedTheme, theme } = useTheme();
	const [fill, setFill] = useState("transparent");

	useEffect(() => {
		const sync = () => setFill(resolveSenseLiquidFill(role));
		sync();
		// Theme class lands on <html>; re-probe after next-themes paints.
		const raf = window.requestAnimationFrame(sync);
		return () => window.cancelAnimationFrame(raf);
	}, [role, resolvedTheme, theme]);

	return fill;
}

export type SenseLiquidProps = Omit<
	LiquidProps,
	"blur" | "contrast" | "fill"
> & {
	/** Theme token for the liquid silhouette — never hard-coded white. */
	fillRole?: SenseLiquidFillRole;
	/** Force-disable (e.g. parent already decided). */
	enabled?: boolean;
	blur?: number;
	contrast?: number;
	fill?: string;
	children: ReactNode;
};

/**
 * `liquid-gooey` hardcodes inline `position: relative` on the host. Tailwind
 * `absolute inset-0` on that same node is ignored, so the host collapses as a
 * flex sibling and the SVG filter clips / smears the active label. Overlay
 * call sites must size an outer absolute shell; Liquid only fills it.
 */
function splitOverlayClassName(className: string | undefined): {
	shellClassName: string | undefined;
	innerClassName: string | undefined;
	isOverlay: boolean;
} {
	if (!className) {
		return {
			shellClassName: undefined,
			innerClassName: undefined,
			isOverlay: false,
		};
	}
	const tokens = className.split(/\s+/).filter(Boolean);
	const overlayHints = new Set([
		"absolute",
		"inset-0",
		"pointer-events-none",
		"z-0",
	]);
	const isOverlay = tokens.some(
		(t) => overlayHints.has(t) || t.startsWith("z-"),
	);
	if (!isOverlay) {
		return {
			shellClassName: undefined,
			innerClassName: className,
			isOverlay: false,
		};
	}
	const shell: string[] = [];
	const inner: string[] = [];
	for (const t of tokens) {
		if (overlayHints.has(t) || t.startsWith("z-")) shell.push(t);
		else inner.push(t);
	}
	// Ensure the shell actually covers the track even if a call site omitted one token.
	if (!shell.includes("absolute")) shell.push("absolute");
	if (!shell.includes("inset-0")) shell.push("inset-0");
	return {
		shellClassName: shell.join(" "),
		innerClassName: cn("h-full w-full", inner.join(" ")),
		isOverlay: true,
	};
}

/**
 * Sense-themed `liquid-gooey` host. When disabled, renders a plain relative
 * wrapper so call sites keep the same layout box without SVG filters.
 */
export function SenseLiquid({
	fillRole = "card",
	enabled: enabledProp,
	blur = SENSE_LIQUID_BLUR,
	contrast = SENSE_LIQUID_CONTRAST,
	fill,
	className,
	style,
	children,
	shadow,
	filterPadding = 40,
	...rest
}: SenseLiquidProps) {
	const autoEnabled = useSenseLiquidEnabled();
	const enabled = enabledProp ?? autoEnabled;
	const themeFill = useSenseLiquidFill(fillRole);
	const resolvedFill = fill ?? themeFill;
	const { shellClassName, innerClassName, isOverlay } =
		splitOverlayClassName(className);

	const fallback = (
		<div
			className={cn(
				isOverlay ? shellClassName : "relative",
				!isOverlay && className,
			)}
			style={style}
			{...(rest as ComponentPropsWithoutRef<"div">)}
		>
			{children}
		</div>
	);

	if (!enabled) {
		return (
			<SenseLiquidEnabledContext.Provider value={false}>
				{fallback}
			</SenseLiquidEnabledContext.Provider>
		);
	}

	// Wait for a concrete fill — mounting Liquid with transparent/white flash looks broken.
	if (!resolvedFill || resolvedFill === "transparent") {
		return (
			<SenseLiquidEnabledContext.Provider value={false}>
				{fallback}
			</SenseLiquidEnabledContext.Provider>
		);
	}

	const liquid = (
		<Liquid
			blur={blur}
			contrast={contrast}
			fill={resolvedFill}
			shadow={shadow}
			filterPadding={filterPadding}
			// Fill the overlay shell; never rely on Tailwind absolute on Liquid itself.
			className={cn(
				isOverlay ? innerClassName : "relative",
				!isOverlay && className,
			)}
			style={{
				...(isOverlay ? { width: "100%", height: "100%" } : null),
				...style,
			}}
			{...rest}
		>
			{children}
		</Liquid>
	);

	return (
		<SenseLiquidEnabledContext.Provider value={true}>
			{isOverlay ? (
				<div className={shellClassName} aria-hidden>
					{liquid}
				</div>
			) : (
				liquid
			)}
		</SenseLiquidEnabledContext.Provider>
	);
}

export type SenseLiquidItemProps = LiquidItemProps & {
	/** When false, render children without a Liquid.Item shell. */
	enabled?: boolean;
};

/** Passthrough `Liquid.Item` that collapses when the host Liquid is disabled. */
export function SenseLiquidItem({
	enabled: enabledProp,
	className,
	children,
	...rest
}: SenseLiquidItemProps) {
	const hostEnabled = useContext(SenseLiquidEnabledContext);
	const enabled = enabledProp ?? hostEnabled;

	if (!enabled) {
		return <div className={cn("relative", className)}>{children}</div>;
	}

	return (
		<Liquid.Item className={className} {...rest}>
			{children}
		</Liquid.Item>
	);
}
