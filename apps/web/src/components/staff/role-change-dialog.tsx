"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { RoleBadgePill } from "@/components/staff/role-badge-pill";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	type RoleChangeDirection,
	roleChangeDialogCopy,
} from "@/lib/role-change-dialog-copy";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

export function RoleChangeDialog({
	open,
	direction,
	newRole,
	onDismiss,
}: {
	open: boolean;
	direction: RoleChangeDirection;
	newRole: string;
	onDismiss: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	const copy = roleChangeDialogCopy(direction, newRole);

	const handleDismiss = useCallback(() => onDismiss(), [onDismiss]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleDismiss();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleDismiss]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.25, ease: PANEL_EASE };

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="role-change-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-8",
					)}
					onClick={handleDismiss}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, scale: 0.96, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={panelTransition}
						onClick={(e) => e.stopPropagation()}
						className={cn(
							"t-modal relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-[2rem] bg-card px-6 pt-12 pb-10 text-center text-foreground sm:px-8",
							"is-open",
						)}
					>
						<div className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={handleDismiss}
								aria-label="Close"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="mb-6">
							<RoleBadgePill role={newRole} label={copy.pillLabel} />
						</div>

						<h2
							id={titleId}
							className="text-balance font-semibold text-2xl tracking-tight"
						>
							{copy.title}
						</h2>
						<p
							id={descriptionId}
							className="mt-1 text-balance font-semibold text-foreground text-xl tracking-tight"
						>
							{copy.headline}
						</p>
						{copy.subtext ? (
							<p className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
								{copy.subtext}
							</p>
						) : null}

						<div className="mt-7 flex w-full flex-col items-center gap-2">
							<Button
								type="button"
								variant="default"
								size="pill"
								onClick={handleDismiss}
								className="min-h-11 w-full max-w-xs rounded-full bg-foreground font-semibold text-background"
							>
								Got it
							</Button>
							{copy.showStaffPanelCta ? (
								<Link
									href="/staff"
									onClick={handleDismiss}
									className="inline-flex min-h-9 items-center rounded-full px-3 py-1 font-medium text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									Open staff panel
								</Link>
							) : null}
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
