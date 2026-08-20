"use client";

import { cn } from "@still/ui/lib/utils";
import type { MetalFxTheme } from "metal-fx";
import { MetalFx, resumeShared } from "metal-fx";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useMemo } from "react";

import { isAppThemeLight, resolveAppTheme } from "@/lib/app-themes";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	patronCanUpgradePlan,
	pricingHrefForPlanUpgrade,
} from "@/lib/patron-plan-upgrade";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** Pricing upsell — hidden when the patron is already on Devoted. */
export function AccountMenuUpgradePlanButton({
	planTier,
	className,
	onNavigate,
	reflectionTargets,
	/** Mount the WebGL effect only while the host surface is open. */
	effectActive = true,
}: {
	planTier?: unknown;
	className?: string;
	/** Close host menu/sheet before routing (mobile You sheet). */
	onNavigate?: () => void;
	/** Sibling controls that receive proximity metal reflections (dark theme only). */
	reflectionTargets?: ReadonlyArray<RefObject<HTMLElement | null>>;
	effectActive?: boolean;
}) {
	const router = useRouter();
	const reducedMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const { resolvedTheme, theme } = useTheme();

	const canUpgrade = patronCanUpgradePlan(planTier);
	const href = canUpgrade ? pricingHrefForPlanUpgrade(planTier) : null;

	const metalTheme = useMemo((): MetalFxTheme => {
		const appTheme = resolveAppTheme(resolvedTheme ?? theme);
		return isAppThemeLight(appTheme) ? "light" : "dark";
	}, [resolvedTheme, theme]);

	const useMetalFx =
		canUpgrade &&
		Boolean(href) &&
		!reducedMotion &&
		!softwareGpu &&
		effectActive;

	// Keep the shared RAF alive while the menu/sheet is open (patched metal-fx
	// no longer freezes on false IntersectionObserver hits inside popovers).
	useEffect(() => {
		if (!useMetalFx) {
			return;
		}
		resumeShared();
		let frame2 = 0;
		const frame1 = window.requestAnimationFrame(() => {
			resumeShared();
			frame2 = window.requestAnimationFrame(() => resumeShared());
		});
		return () => {
			window.cancelAnimationFrame(frame1);
			window.cancelAnimationFrame(frame2);
		};
	}, [useMetalFx]);

	if (!canUpgrade || !href) {
		return null;
	}

	const handleClick = () => {
		onNavigate?.();
		router.push(href);
	};

	const buttonClassName = cn(
		"flex w-full items-center justify-center rounded-full bg-background py-3 font-semibold text-base text-foreground",
		"transition-[transform,colors] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	);

	const plainButton = (
		<button type="button" onClick={handleClick} className={buttonClassName}>
			Upgrade plan
		</button>
	);

	return (
		<div className={cn("mt-3 w-full", className)}>
			{useMetalFx ? (
				// Inline mount — body portal was a workaround for stock metal-fx
				// hiding itself (visibility/IO). Patched package keeps the host
				// opaque + instance.visible so the plasma loop runs in-menu.
				<MetalFx
					preset="chromatic"
					strength={1}
					variant="button"
					theme={metalTheme}
					paused={false}
					reflectionTargets={reflectionTargets}
					className="account-menu-metal-fx visible! block w-full"
					style={{ background: "var(--background)" }}
				>
					<button
						type="button"
						onClick={handleClick}
						className={cn(buttonClassName, "w-full")}
					>
						Upgrade plan
					</button>
				</MetalFx>
			) : (
				plainButton
			)}
		</div>
	);
}
