"use client";

import IconShareIn from "@still/ui/icons/share-in";
import { cn } from "@still/ui/lib/utils";
import { usePathname } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";
import { useMeAccountBarActions } from "@/components/profile/me-account-bar-actions-context";
import { useMeAccountSession } from "@/components/profile/me-account-session-context";
import { MeSaveButton } from "@/components/profile/me-save-button";
import { MeSecondaryButton } from "@/components/profile/me-secondary-button";
import { useSettingsReturn } from "@/components/profile/use-settings-return";
import {
	ME_ACCOUNT_NAV_ITEMS,
	resolveMeAccountNavPath,
} from "@/lib/me-account-nav";

/** Sticky account chrome — back left, section `h1` center, Save / Cancel right. */
export function MeAccountTopBar({ handle: _handle }: { handle: string }) {
	const { actions } = useMeAccountBarActions();
	const { requestLeaveTo, anyUnsaved } = useMeAccountSession();
	const back = useSettingsReturn();
	const pathname = usePathname() ?? "";
	const [isScrolled, setIsScrolled] = useState(false);

	const resolvedNav = resolveMeAccountNavPath(pathname);
	const sectionTitle =
		ME_ACCOUNT_NAV_ITEMS.find((item) => item.href === resolvedNav)?.label ??
		"Settings";

	useEffect(() => {
		// Same scroll scrim as `/home` sticky chrome and `ProfileTopBar`.
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const handleBackNavClick = useCallback(
		(e: MouseEvent<HTMLAnchorElement>) => {
			if (!anyUnsaved()) return;
			e.preventDefault();
			requestLeaveTo(back.href);
		},
		[anyUnsaved, back.href, requestLeaveTo],
	);

	// Raised `bg-card` on canvas — avoid `hover:bg-muted/*` (Calm: muted ≈ card).
	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-foreground/10",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	return (
		<header
			className={cn(
				"sticky top-0 z-30 w-full overflow-visible bg-background",
				"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
				isScrolled && "after:opacity-100",
			)}
		>
			{/* Equal side tracks so the section title stays optically centered. */}
			<div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink
						href={back.href}
						className={cn(pill, "max-w-full pl-3")}
						onClick={handleBackNavClick}
					>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="truncate">{back.label}</span>
					</DetailMotionLink>
				</div>
				<h1 className="min-w-0 truncate px-1 text-center font-semibold text-base text-foreground tracking-tight sm:text-lg">
					{sectionTitle}
				</h1>
				<div className="flex min-w-0 justify-end">
					{actions && (actions.canSave || actions.saving) ? (
						<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
							<MeSecondaryButton
								type="button"
								size="compact"
								onClick={actions.onCancel}
								disabled={actions.saving || !actions.canSave}
								aria-label="Discard unsaved changes"
							>
								Cancel
							</MeSecondaryButton>
							<MeSaveButton
								type="button"
								size="compact"
								onClick={() => void actions.onSave()}
								loading={Boolean(actions.saving)}
								disabled={actions.saving || !actions.canSave}
							>
								Save
							</MeSaveButton>
						</div>
					) : null}
				</div>
			</div>
		</header>
	);
}
