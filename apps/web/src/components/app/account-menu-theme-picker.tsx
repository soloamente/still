"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useAppThemeShell } from "@/components/app/app-theme-shell";
import { api } from "@/lib/api";
import {
	APP_THEME_LIST,
	type AppThemeClass,
	appThemeTier,
	resolveAppTheme,
} from "@/lib/app-themes";
import { PROFILE_PREF_APP_THEME } from "@/lib/profile-preferences";

/**
 * Home-style filter chips for palette switching inside the account menu's
 * `bg-background` inset group. Persists to profile on pick (no Settings Save).
 */
export function AccountMenuThemePicker({
	className,
	isPro = false,
}: {
	className?: string;
	isPro?: boolean;
}) {
	const menuThemes = useMemo(
		() =>
			APP_THEME_LIST.filter(
				(def) => def.tier === "free" || (def.tier === "pro" && isPro),
			),
		[isPro],
	);
	const { theme, resolvedTheme } = useTheme();
	const { applyThemeSelection } = useAppThemeShell();
	const reduceMotion = useReducedMotion();
	const activeTheme = useMemo(
		() => resolveAppTheme(resolvedTheme ?? theme),
		[resolvedTheme, theme],
	);

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const denseMenu = menuThemes.length > 3;

	const chipButton = (isActive: boolean) =>
		cn(
			"relative inline-flex min-h-10 w-full min-w-0 items-center justify-center rounded-full text-center font-medium transition-colors duration-200 ease-out motion-reduce:transition-none",
			denseMenu ? "px-1.5 text-xs" : "px-2 py-2.5 text-sm sm:px-3",
			isActive
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const handlePick = useCallback(
		async (next: AppThemeClass) => {
			if (next === activeTheme) return;
			if (appThemeTier(next) === "pro" && !isPro) return;
			applyThemeSelection(next);
			try {
				await api.api.profiles.me.patch({
					preferences: {
						[PROFILE_PREF_APP_THEME]: next,
					},
				});
			} catch (err) {
				console.error("[account-menu] theme save failed", err);
				toast.error("Couldn't save theme");
			}
		},
		[activeTheme, applyThemeSelection, isPro],
	);

	return (
		<div className={cn("space-y-2 px-1 pt-1", className)}>
			{/* <p
				id="account-menu-theme-label"
				className="px-2 font-medium text-foreground text-sm"
			>
				Theme
			</p> */}
			<div
				className={cn(
					"grid w-full gap-1 bg-card p-1",
					/* Three columns — five Pro moods wrap to 3+2 inside the narrow menu. */
					denseMenu
						? "grid-cols-3 rounded-[1.5rem]"
						: "grid-cols-3 rounded-full",
				)}
				role="toolbar"
				aria-labelledby="account-menu-theme-label"
			>
				{menuThemes.map((def) => {
					const isActive = activeTheme === def.className;
					return (
						<button
							key={def.className}
							type="button"
							aria-pressed={isActive}
							className={chipButton(isActive)}
							onClick={() => handlePick(def.className)}
						>
							{isActive ? (
								<motion.span
									layoutId="account-menu-theme-pill"
									className="absolute inset-0 z-0 rounded-full bg-background"
									transition={pillTransition}
									aria-hidden
								/>
							) : null}
							<span className="relative z-10 truncate px-0.5">{def.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
