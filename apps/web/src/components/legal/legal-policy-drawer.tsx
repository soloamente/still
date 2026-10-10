"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { LegalPolicyContent } from "@/components/legal/legal-policy-content";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatLegalLastUpdated } from "@/lib/legal-format";
import {
	getLegalPolicy,
	LEGAL_NAV,
	type LegalPolicyId,
} from "@/lib/legal-policy-bodies";
import { LEGAL_TRADER } from "@/lib/legal-trader";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**
 * Shared legal sheet body — used by the in-place auth overlay so Privacy /
 * Terms never wipe the film backdrop behind the scrim.
 */
export function LegalPolicyDrawerBody({
	policyId,
	open,
	onSelectPolicy,
}: {
	policyId: LegalPolicyId;
	open: boolean;
	/** When set, peer policy chips swap the open sheet instead of navigating. */
	onSelectPolicy?: (id: LegalPolicyId) => void;
}) {
	const policy = getLegalPolicy(policyId);
	const trader = LEGAL_TRADER;
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
	);

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="mx-auto w-full max-w-xl px-1 pt-1 pb-6 sm:px-2">
					<nav
						aria-label="Legal pages"
						className="mb-6 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs sm:text-sm"
					>
						{LEGAL_NAV.map((item) =>
							onSelectPolicy ? (
								<button
									key={item.id}
									type="button"
									className={
										item.id === policyId
											? "font-medium text-foreground"
											: "[@media(hover:hover)]:hover:text-foreground"
									}
									aria-current={item.id === policyId ? "page" : undefined}
									onClick={() => onSelectPolicy(item.id)}
								>
									{item.label}
								</button>
							) : (
								<Link
									key={item.id}
									href={item.href}
									className={
										item.id === policyId
											? "font-medium text-foreground"
											: "[@media(hover:hover)]:hover:text-foreground"
									}
									aria-current={item.id === policyId ? "page" : undefined}
									scroll={false}
								>
									{item.label}
								</Link>
							),
						)}
					</nav>

					<p className="mb-6 text-muted-foreground text-sm">
						Last updated {formatLegalLastUpdated(trader.lastUpdated)}
					</p>

					{/* Title lives inside LegalPolicyContent for drawer density. */}
					<span className="sr-only">{policy.description}</span>
					<LegalPolicyContent policyId={policyId} variant="drawer" />
				</div>
			</DetailDrawerScrollBody>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
				footerTone="filmography"
			/>
		</div>
	);
}

/**
 * Vaul legal sheet over the current page — auth stills / app chrome stay under
 * the scrim like filmography and review drawers.
 */
export function LegalPolicyDrawer({
	policyId,
	open,
	onOpenChange,
	onSelectPolicy,
}: {
	policyId: LegalPolicyId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectPolicy?: (id: LegalPolicyId) => void;
}) {
	const policy = getLegalPolicy(policyId);
	const trader = LEGAL_TRADER;

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={onOpenChange}
			appStack
			dismissOnRouteChange={false}
			title={policy.title}
			description={`${policy.title}. Last updated ${formatLegalLastUpdated(trader.lastUpdated)}.`}
			handleTrailing={
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label="Close"
					className={cn(
						"size-10 rounded-full bg-background text-foreground",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					onClick={() => onOpenChange(false)}
				>
					<X className="size-4" aria-hidden />
				</Button>
			}
		>
			<LegalPolicyDrawerBody
				policyId={policyId}
				open={open}
				onSelectPolicy={onSelectPolicy}
			/>
		</DetailVaulSheet>
	);
}
