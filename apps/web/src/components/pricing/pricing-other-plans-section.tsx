"use client";

import IconPeople from "@still/ui/icons/people";
import IconTicket from "@still/ui/icons/ticket";
import { cn } from "@still/ui/lib/utils";
import { type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { openInviteEarnDialog } from "@/components/referrals/invite-earn-dialog-root";
import { captureReferralClient } from "@/lib/capture-referral-client";
import {
	fetchReferralRefereeStatusClient,
	type ReferralRefereeStatus,
} from "@/lib/fetch-referral-referee-status-client";
import { clearReferralCookie, readReferralCookie } from "@/lib/referral-cookie";

type PricingOtherPlansSectionProps = {
	isSignedIn: boolean;
};

/** Raised card chrome — matches Compare / Questions (outer 24, pad 8, inner 16). */
const OTHER_PLANS_SHELL_CLASS = "mx-auto mt-16 max-w-3xl min-[1280px]:mt-20";
const OTHER_PLANS_CARD_CLASS = "rounded-mobbin-3xl bg-card p-2 sm:p-3";
const OTHER_PLANS_GRID_CLASS = "grid gap-2 min-[720px]:grid-cols-2";
const OTHER_PLANS_TILE_CLASS =
	"flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-background px-5 py-8";
const OTHER_PLANS_TITLE_CLASS =
	"text-center text-balance font-semibold text-base text-foreground";
const OTHER_PLANS_BODY_CLASS =
	"text-center text-pretty text-muted-foreground text-sm leading-relaxed";
const OTHER_PLANS_PILL_CLASS = cn(
	"inline-flex min-h-10 select-none items-center justify-center rounded-full bg-card px-4",
	"font-medium text-foreground text-sm",
	"[@media(hover:hover)]:hover:bg-card/80",
	"disabled:cursor-not-allowed disabled:opacity-50",
);

const FRIEND_INVITE_TITLE = "Have a friend's invite code?";

function OtherPlanIcon({ children }: { children: ReactNode }) {
	return (
		<span className="text-foreground" aria-hidden>
			{children}
		</span>
	);
}

function PricingReferralApplyForm({
	inputId,
	referralCode,
	applyLoading,
	onCodeChange,
	onSubmit,
}: {
	inputId: string;
	referralCode: string;
	applyLoading: boolean;
	onCodeChange: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<form
			className="flex w-full max-w-xs flex-col items-center gap-y-2 pt-1"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit();
			}}
		>
			<label htmlFor={inputId} className="sr-only">
				Friend invite code
			</label>
			<input
				id={inputId}
				type="text"
				autoComplete="off"
				spellCheck={false}
				placeholder="Invite code"
				value={referralCode}
				onChange={(event) => onCodeChange(event.target.value)}
				className={cn(
					"h-10 w-full rounded-2xl bg-card px-3 text-center text-base text-foreground outline-none sm:text-sm",
					"placeholder:text-muted-foreground",
				)}
			/>
			<button
				type="submit"
				disabled={applyLoading}
				className={OTHER_PLANS_PILL_CLASS}
			>
				{applyLoading ? "Applying…" : "Apply code"}
			</button>
		</form>
	);
}

/** Secondary promos below tier cards — friend invite + Invite & earn. */
export function PricingOtherPlansSection({
	isSignedIn,
}: PricingOtherPlansSectionProps) {
	const inputId = useId();
	const [status, setStatus] = useState<ReferralRefereeStatus | null>(null);
	const [statusLoading, setStatusLoading] = useState(isSignedIn);
	const [referralCode, setReferralCode] = useState("");
	const [applyLoading, setApplyLoading] = useState(false);
	const [applyFormOpen, setApplyFormOpen] = useState(false);

	const refreshStatus = useCallback(async () => {
		if (!isSignedIn) {
			setStatus(null);
			setStatusLoading(false);
			return;
		}

		setStatusLoading(true);
		try {
			const next = await fetchReferralRefereeStatusClient();
			setStatus(next);
		} catch {
			setStatus(null);
		} finally {
			setStatusLoading(false);
		}
	}, [isSignedIn]);

	useEffect(() => {
		void refreshStatus();
	}, [refreshStatus]);

	// Prefill from the 30-day referral cookie when Invite & earn shipped after sign-up.
	useEffect(() => {
		if (!isSignedIn || statusLoading) return;
		if (!status?.canApplyReferralCode) return;

		const cookieCode = readReferralCookie();
		if (cookieCode) {
			setReferralCode(cookieCode);
			setApplyFormOpen(true);
		}
	}, [isSignedIn, status?.canApplyReferralCode, statusLoading]);

	const handleApplyReferral = useCallback(async () => {
		const trimmed = referralCode.trim();
		if (!trimmed || applyLoading) return;

		setApplyLoading(true);
		try {
			const result = await captureReferralClient(trimmed);
			if (!result.ok) {
				toast.error(result.message);
				return;
			}

			clearReferralCookie();
			setApplyFormOpen(false);
			toast.success("Friend invite linked — 10% off applies at checkout.");
			await refreshStatus();
		} finally {
			setApplyLoading(false);
		}
	}, [applyLoading, referralCode, refreshStatus]);

	if (!isSignedIn) return null;

	const showApplyForm =
		applyFormOpen &&
		(status?.canApplyReferralCode ||
			(!statusLoading &&
				!status?.referralDiscountEligible &&
				!status?.referralDiscountRedeemed));

	return (
		<div className={OTHER_PLANS_SHELL_CLASS}>
			<section
				aria-label="More ways to join Sense"
				className={OTHER_PLANS_CARD_CLASS}
			>
				<div className={OTHER_PLANS_GRID_CLASS}>
					<article className={OTHER_PLANS_TILE_CLASS}>
						<OtherPlanIcon>
							<IconTicket size="24px" aria-hidden />
						</OtherPlanIcon>
						<h3 className={OTHER_PLANS_TITLE_CLASS}>{FRIEND_INVITE_TITLE}</h3>

						{statusLoading ? (
							<p className={OTHER_PLANS_BODY_CLASS}>
								Apply it for <span className="whitespace-nowrap">10% off</span>{" "}
								your first Attuned or Immersed plan.
							</p>
						) : status?.canApplyReferralCode ? (
							<>
								<p className={OTHER_PLANS_BODY_CLASS}>
									Apply it for{" "}
									<span className="whitespace-nowrap">10% off</span> your first
									Attuned or Immersed plan — including if you joined before
									Invite &amp; earn.
								</p>
								{showApplyForm ? (
									<PricingReferralApplyForm
										inputId={inputId}
										referralCode={referralCode}
										applyLoading={applyLoading}
										onCodeChange={setReferralCode}
										onSubmit={() => {
											void handleApplyReferral();
										}}
									/>
								) : (
									<button
										type="button"
										onClick={() => setApplyFormOpen(true)}
										className={OTHER_PLANS_PILL_CLASS}
									>
										Apply invite code
									</button>
								)}
							</>
						) : status?.referralDiscountEligible ? (
							<p className={OTHER_PLANS_BODY_CLASS}>
								Your friend invite is linked.{" "}
								<span className="whitespace-nowrap">10% off</span> applies at
								checkout on Attuned or Immersed.
							</p>
						) : status?.referralDiscountRedeemed ? (
							<p className={OTHER_PLANS_BODY_CLASS}>
								You&apos;ve already used your friend invite discount on a
								subscription.
							</p>
						) : (
							<>
								<p className={OTHER_PLANS_BODY_CLASS}>
									Apply it for{" "}
									<span className="whitespace-nowrap">10% off</span> your first
									Attuned or Immersed plan — including if you joined before
									Invite &amp; earn.
								</p>
								{showApplyForm ? (
									<PricingReferralApplyForm
										inputId={inputId}
										referralCode={referralCode}
										applyLoading={applyLoading}
										onCodeChange={setReferralCode}
										onSubmit={() => {
											void handleApplyReferral();
										}}
									/>
								) : (
									<button
										type="button"
										onClick={() => setApplyFormOpen(true)}
										className={OTHER_PLANS_PILL_CLASS}
									>
										Apply invite code
									</button>
								)}
							</>
						)}
					</article>

					<article className={OTHER_PLANS_TILE_CLASS}>
						<OtherPlanIcon>
							<IconPeople size="24px" aria-hidden />
						</OtherPlanIcon>
						<h3 className={OTHER_PLANS_TITLE_CLASS}>Invite &amp; earn</h3>
						<p className={OTHER_PLANS_BODY_CLASS}>
							Share Sense with friends — they get{" "}
							<span className="whitespace-nowrap">10% off</span> their first
							paid plan and you unlock milestone rewards as they join.
						</p>
						<button
							type="button"
							onClick={openInviteEarnDialog}
							className={OTHER_PLANS_PILL_CLASS}
						>
							Invite friends
						</button>
					</article>
				</div>
			</section>
		</div>
	);
}
