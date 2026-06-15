"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

type OnboardingWizardLayoutProps = {
	/** Brand row above the wizard column (e.g. wordmark). */
	header?: ReactNode;
	/** Animated step shell + controls. */
	wizard: ReactNode;
	/** Desktop live profile preview (right column). */
	preview?: ReactNode;
	/** Optional alignment override for the preview column (e.g. taste grid stretch). */
	previewClassName?: string;
	/** Compact preview strip on narrow viewports during identity steps. */
	previewStrip?: ReactNode;
	className?: string;
};

/**
 * Full-bleed onboarding canvas — wizard column + optional preview panel.
 * Outside `(app)` shell; no bottom nav inset.
 */
export function OnboardingWizardLayout({
	header,
	wizard,
	preview,
	previewClassName,
	previewStrip,
	className,
}: OnboardingWizardLayoutProps) {
	return (
		<main
			className={cn(
				// Explicit viewport height so the inner card can flex-fill (min-h alone breaks % height).
				"box-border flex h-dvh min-h-0 w-full bg-background p-2.5 font-medium",
				className,
			)}
		>
			<div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl bg-card lg:flex-row lg:gap-10 lg:px-8 lg:py-5">
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 lg:max-w-none lg:shrink-0 lg:px-0 lg:py-6">
					{previewStrip ? (
						<div className="mb-6 w-full max-w-[400px] lg:hidden">
							{previewStrip}
						</div>
					) : null}
					{header ? (
						<div className="mb-8 flex w-full max-w-[400px] items-center justify-center">
							{header}
						</div>
					) : null}
					{wizard}
				</div>

				{preview ? (
					<div
						className={cn(
							"relative hidden min-h-0 flex-1 overflow-hidden lg:flex",
							previewClassName ?? "items-center justify-center",
						)}
					>
						{preview}
					</div>
				) : null}
			</div>
		</main>
	);
}
