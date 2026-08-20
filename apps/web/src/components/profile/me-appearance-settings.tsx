"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useCallback } from "react";

import { useAppThemeShell } from "@/components/app/app-theme-shell";
import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import {
	APP_THEME_LIST,
	type AppThemeClass,
	appThemeTier,
	appThemeTierLabel,
} from "@/lib/app-themes";

/** Appearance — app color themes + portrait grayscale preference. */
export function MeAppearanceSettings({
	isPro: _isPro,
	appTheme,
	onAppThemeChange,
	profilePortraitGrayscaleUntilHover,
	onProfilePortraitGrayscaleUntilHoverChange,
}: {
	/** @deprecated use entitlements — kept for caller compat */
	isPro: boolean;
	appTheme: AppThemeClass;
	onAppThemeChange: (next: AppThemeClass) => void;
	profilePortraitGrayscaleUntilHover: boolean;
	onProfilePortraitGrayscaleUntilHoverChange: (next: boolean) => void;
}) {
	const { hasFeature } = usePatronEntitlements();
	const hasAllThemes = hasFeature("all_themes");
	const { applyThemeSelection } = useAppThemeShell();

	const handleThemePick = useCallback(
		(next: AppThemeClass) => {
			if (appThemeTier(next) === "pro" && !hasAllThemes) return;
			applyThemeSelection(next);
			onAppThemeChange(next);
		},
		[applyThemeSelection, hasAllThemes, onAppThemeChange],
	);

	return (
		<div className="space-y-10">
			<div className="space-y-4">
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
						// Form snapshot only — `useTheme()` is unset on the server and
						// already live on the client (hydration mismatch on the radio).
						const selected = appTheme === def.className;
						const locked = def.tier === "pro" && !hasAllThemes;
						const inputId = `app-theme-${def.className}`;
						return (
							<label
								key={def.className}
								htmlFor={inputId}
								className={cn(
									// Raised tile on canvas panel — `rounded-xl` sits concentrically inside
									// `MeSettingsPanel` (`rounded-mobbin-3xl` + ~20–24px padding).
									"relative flex cursor-pointer flex-col gap-3 rounded-xl bg-card p-3.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none sm:p-4",
									locked && "cursor-not-allowed opacity-55",
									"has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
									selected
										? "bg-foreground/8 text-foreground"
										: "text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/5 [@media(hover:hover)]:hover:text-foreground/90",
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
								{/* Selected cue — soft disc, no border/ring chrome. */}
								{selected ? (
									<span
										className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-background"
										aria-hidden
									>
										<span className="block size-2 rounded-full bg-foreground" />
									</span>
								) : null}
								{/* Nested canvas → raised card + accent so swatches stay distinct from the tile. */}
								<span
									className="flex h-12 gap-1.5 overflow-hidden rounded-lg p-1.5 sm:h-14"
									style={{ background: def.preview.canvas }}
									aria-hidden
								>
									<span
										className="min-w-0 flex-1 rounded-md"
										style={{ background: def.preview.raised }}
									/>
									<span
										className="w-5 shrink-0 rounded-md sm:w-6"
										style={{ background: def.preview.accent }}
									/>
								</span>
								<span className="flex flex-col gap-1 pr-6">
									<span className="flex flex-wrap items-center gap-2 font-medium text-sm">
										{def.label}
										{def.tier === "pro" ? (
											<span className="rounded-full bg-background px-2 py-0.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
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

			{/* Separate group from themes — 2× gap vs intra-theme spacing. */}
			<MePreferenceToggle
				id="profile-portrait-grayscale-hover"
				checked={profilePortraitGrayscaleUntilHover}
				onChange={onProfilePortraitGrayscaleUntilHoverChange}
				title="Grayscale portrait until hover"
				description="On your public profile, your portrait stays monochrome until a visitor hovers. Off keeps full color on the profile hero. Does not affect small avatars elsewhere."
			/>
		</div>
	);
}
