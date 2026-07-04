"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import { useAppThemeShell } from "@/components/app/app-theme-shell";
import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { MeProfileExpressionSettings } from "@/components/profile/me-profile-expression-settings";
import {
	APP_THEME_LIST,
	type AppThemeClass,
	appThemeTier,
	appThemeTierLabel,
	resolveAppTheme,
} from "@/lib/app-themes";
import type {
	ProfileAccentId,
	ProfileBannerFrameId,
} from "@/lib/profile-appearance";

export function MeAppearanceSettings({
	isPro: _isPro,
	appTheme,
	onAppThemeChange,
	profileAccent,
	bannerFrame,
	onProfileAccentChange,
	onBannerFrameChange,
	profilePortraitGrayscaleUntilHover,
	onProfilePortraitGrayscaleUntilHoverChange,
}: {
	/** @deprecated use entitlements — kept for caller compat */
	isPro: boolean;
	appTheme: AppThemeClass;
	onAppThemeChange: (next: AppThemeClass) => void;
	profileAccent: ProfileAccentId | null;
	bannerFrame: ProfileBannerFrameId;
	onProfileAccentChange: (next: ProfileAccentId) => void;
	onBannerFrameChange: (next: ProfileBannerFrameId) => void;
	profilePortraitGrayscaleUntilHover: boolean;
	onProfilePortraitGrayscaleUntilHoverChange: (next: boolean) => void;
}) {
	const { hasFeature } = usePatronEntitlements();
	const hasAllThemes = hasFeature("all_themes");
	const { theme } = useTheme();
	const { applyThemeSelection } = useAppThemeShell();
	const activeTheme = useMemo(
		() => resolveAppTheme(theme ?? appTheme),
		[appTheme, theme],
	);

	const handleThemePick = useCallback(
		(next: AppThemeClass) => {
			if (appThemeTier(next) === "pro" && !hasAllThemes) return;
			applyThemeSelection(next);
			onAppThemeChange(next);
		},
		[applyThemeSelection, hasAllThemes, onAppThemeChange],
	);

	return (
		<div className="space-y-8">
			<div className="space-y-3">
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">Color theme</p>
					<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
						Named palettes for the whole app — canvas, cards, and accent. Each
						name is a mood — <span className="text-foreground">Calm</span> is
						the default settled dark.
					</p>
				</div>
				<fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
					<legend className="sr-only">Color theme</legend>
					{APP_THEME_LIST.map((def) => {
						const selected = activeTheme === def.className;
						const locked = def.tier === "pro" && !hasAllThemes;
						const inputId = `app-theme-${def.className}`;
						return (
							<label
								key={def.className}
								htmlFor={inputId}
								className={cn(
									"flex cursor-pointer flex-col gap-3 rounded-2xl bg-card p-4 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
									locked && "cursor-not-allowed opacity-55",
									"has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
									selected
										? "text-foreground"
										: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
								)}
							>
								<input
									id={inputId}
									type="radio"
									name="app-theme"
									className="sr-only"
									checked={selected}
									disabled={locked}
									onChange={() => handleThemePick(def.className)}
								/>
								<span className="flex gap-1.5" aria-hidden>
									<span
										className="h-8 flex-1 rounded-lg"
										style={{ background: def.preview.canvas }}
									/>
									<span
										className="h-8 w-8 shrink-0 rounded-lg"
										style={{ background: def.preview.raised }}
									/>
									<span
										className="h-8 w-5 shrink-0 rounded-lg"
										style={{ background: def.preview.accent }}
									/>
								</span>
								<span className="flex flex-col gap-1">
									<span className="flex items-center gap-2 font-medium text-sm">
										{def.label}
										{def.tier === "pro" ? (
											<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
												{appThemeTierLabel(def.tier)}
											</span>
										) : null}
									</span>
									{locked ? (
										<Link
											href="/pricing#immersed"
											className="w-fit font-medium text-foreground text-xs underline-offset-4 [@media(hover:hover)]:hover:underline"
											onClick={(event) => event.stopPropagation()}
										>
											Upgrade
										</Link>
									) : null}
								</span>
							</label>
						);
					})}
				</fieldset>
			</div>

			<MeProfileExpressionSettings
				profileAccent={profileAccent}
				bannerFrame={bannerFrame}
				onProfileAccentChange={onProfileAccentChange}
				onBannerFrameChange={onBannerFrameChange}
				profilePortraitGrayscaleUntilHover={profilePortraitGrayscaleUntilHover}
				onProfilePortraitGrayscaleUntilHoverChange={
					onProfilePortraitGrayscaleUntilHoverChange
				}
			/>
		</div>
	);
}
