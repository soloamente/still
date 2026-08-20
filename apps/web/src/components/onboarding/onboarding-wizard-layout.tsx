"use client";

import { cn } from "@still/ui/lib/utils";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** Same visually-hidden → fixed pill pattern as the marketing skip link. */
const ONBOARDING_SKIP_LINK_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-background focus:px-4 focus:font-sans focus:text-foreground focus:text-sm";

/** Replay panel-reveal when the preview kind changes; skip the first paint. */
function OnboardingPreviewReveal({
	revealKey,
	children,
}: {
	revealKey: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(true);
	const prevKey = useRef(revealKey);

	useLayoutEffect(() => {
		if (prevKey.current === revealKey) return;
		prevKey.current = revealKey;
		setOpen(false);
		let inner = 0;
		const outer = window.requestAnimationFrame(() => {
			inner = window.requestAnimationFrame(() => {
				setOpen(true);
			});
		});
		return () => {
			window.cancelAnimationFrame(outer);
			window.cancelAnimationFrame(inner);
		};
	}, [revealKey]);

	return (
		<div
			className={cn(
				/*
				  Fill the aside via flex-1 + min-h-0, not size-full (% height).
				  In a column flex parent, height:100% often resolves to content
				  height — then import's min-h-full center shell is a no-op and
				  the specimen sticks to the top.
				*/
				"t-panel-slide relative flex min-h-0 w-full flex-1 flex-col",
				"[--panel-translate-y:28px]",
				// Poster grids: skip cross-blur — filter + opacity 0 stalls Next/Image lazy load.
				revealKey === "catalogue" && "[--panel-blur:0px]",
				// Import specimen — short travel so the pane feels settled, not theatrical.
				revealKey === "import" &&
					"[--panel-blur:2px] [--panel-open-dur:320ms] [--panel-translate-y:16px]",
			)}
			data-open={open ? "true" : "false"}
		>
			{children}
		</div>
	);
}

type OnboardingWizardLayoutProps = {
	/** Brand row above the wizard column (e.g. wordmark). */
	header?: ReactNode;
	/** Compact progress meter opposite the wordmark. */
	progress?: ReactNode;
	/** Animated step shell + controls. */
	wizard: ReactNode;
	/** Desktop live profile preview (right column). */
	preview?: ReactNode;
	/** Stable key so identity ↔ catalogue preview can panel-reveal. */
	previewKey?: string;
	/** Optional alignment override for the preview column (e.g. taste grid stretch). */
	previewClassName?: string;
	/** Compact preview strip on narrow viewports during identity steps. */
	previewStrip?: ReactNode;
	className?: string;
};

/**
 * Full-bleed onboarding canvas — wizard rail + preview pane.
 * Outside `(app)` shell; no bottom nav inset.
 * Desktop uses a near-half split so the setup column keeps pace with the
 * preview; form/copy inside is capped (`max-w-md` / `lg:max-w-lg`).
 */
export function OnboardingWizardLayout({
	header,
	progress,
	wizard,
	preview,
	previewKey = "preview",
	previewClassName,
	previewStrip,
	className,
}: OnboardingWizardLayoutProps) {
	return (
		<main
			className={cn(
				// Mobile must remain scrollable for longer onboarding steps.
				"box-border flex min-h-dvh w-full overflow-y-auto overflow-x-hidden bg-background p-2.5 font-medium",
				className,
			)}
		>
			<a className={ONBOARDING_SKIP_LINK_CLASS} href="#onboarding-setup">
				Skip to setup
			</a>
			<div className="flex min-h-[calc(100dvh-1.25rem)] w-full flex-1 flex-col overflow-hidden rounded-3xl bg-card lg:h-[calc(100dvh-1.25rem)] lg:max-h-[calc(100dvh-1.25rem)] lg:flex-row">
				<section
					aria-label="Setup"
					className="flex min-h-0 w-full flex-1 scroll-mt-4 flex-col lg:w-[45%] lg:min-w-[28rem] lg:flex-none lg:shrink-0 xl:w-1/2"
					id="onboarding-setup"
				>
					<div className="flex min-h-0 flex-1 flex-col items-stretch justify-start overflow-y-auto overscroll-contain px-6 py-8 sm:px-8 lg:justify-center lg:px-14 lg:py-10 xl:px-16">
						{/* Cap form/copy width inside the wider rail; keep it centered in the column. */}
						<div className="mx-auto flex w-full max-w-md flex-col lg:max-w-lg">
							{previewStrip ? (
								<div className="mb-6 w-full lg:hidden">{previewStrip}</div>
							) : null}
							{header || progress ? (
								<div className="mb-8 flex w-full items-center justify-between gap-4 px-1.5">
									{header ? (
										<div className="flex min-w-0 items-center">{header}</div>
									) : (
										<span />
									)}
									{progress}
								</div>
							) : null}
							{wizard}
						</div>
					</div>
				</section>

				{preview ? (
					<aside
						aria-label="Profile preview"
						className={cn(
							// Column flex so items/justify match stretch vs centered specimens.
							"relative hidden min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col",
							previewClassName ?? "items-center justify-center",
						)}
					>
						<OnboardingPreviewReveal revealKey={previewKey}>
							{preview}
						</OnboardingPreviewReveal>
					</aside>
				) : null}
			</div>
		</main>
	);
}
