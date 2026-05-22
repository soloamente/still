"use client";

import { cn } from "@still/ui/lib/utils";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import { useAppThemeShell } from "@/components/app/app-theme-shell";
import {
	APP_THEME_LIST,
	type AppThemeClass,
	resolveAppTheme,
} from "@/lib/app-themes";

export function MeAppearanceSettings({
	appTheme,
	onAppThemeChange,
}: {
	appTheme: AppThemeClass;
	onAppThemeChange: (next: AppThemeClass) => void;
}) {
	const { theme } = useTheme();
	const { applyThemeSelection } = useAppThemeShell();
	const activeTheme = useMemo(
		() => resolveAppTheme(theme ?? appTheme),
		[appTheme, theme],
	);

	const handleThemePick = useCallback(
		(next: AppThemeClass) => {
			applyThemeSelection(next);
			onAppThemeChange(next);
		},
		[applyThemeSelection, onAppThemeChange],
	);

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="font-medium text-foreground text-sm">Color theme</p>
				<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
					Named palettes for the whole app — canvas, cards, and accent. Theater
					is the default cinematic dark you see today.
				</p>
			</div>
			<fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-3">
				<legend className="sr-only">Color theme</legend>
				{APP_THEME_LIST.map((def) => {
					const selected = activeTheme === def.className;
					const inputId = `app-theme-${def.className}`;
					return (
						<label
							key={def.className}
							htmlFor={inputId}
							className={cn(
								"flex cursor-pointer flex-col gap-3 rounded-2xl bg-card p-4 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
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
							<span className="font-medium text-sm">{def.label}</span>
						</label>
					);
				})}
			</fieldset>
		</div>
	);
}
