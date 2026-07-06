"use client";

import { cn } from "@still/ui/lib/utils";
import { Gift, Tag } from "lucide-react";
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

/** Mobbin OtherPlansSection parity — numeric gaps are px literals (40 / 24 / 8). */
const MOBBIN_OTHER_PLANS_WRAPPER_CLASS =
	"mx-auto mt-16 max-w-3xl pb-10 pt-10 min-[1280px]:mt-20 min-[1280px]:pb-20";
const MOBBIN_OTHER_PLANS_SECTION_CLASS =
	"flex flex-col gap-y-10 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-x-6 min-[720px]:gap-y-0";
const MOBBIN_OTHER_PLANS_ARTICLE_CLASS =
	"flex min-w-0 flex-1 flex-col items-center gap-y-2";
const MOBBIN_OTHER_PLANS_TITLE_CLASS =
	"text-center font-semibold text-base text-foreground";
const MOBBIN_OTHER_PLANS_BODY_CLASS =
	"text-center text-balance text-muted-foreground text-sm leading-relaxed";
const MOBBIN_OTHER_PLANS_LINK_CLASS =
	"text-muted-foreground text-sm underline underline-offset-4 [@media(hover:hover)]:hover:text-foreground";

const MOBBIN_FRIEND_INVITE_TITLE = "Have a friend's invite code?";

function MobbinOtherPlanIcon({ children }: { children: ReactNode }) {
	return (
		<span className="text-foreground" aria-hidden>
			{children}
		</span>
	);
}

/** Mobbin-style secondary promos below tier cards — friend invite + Invite & earn. */
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

	return (
		<div className={MOBBIN_OTHER_PLANS_WRAPPER_CLASS}>
			<section
				aria-label="More ways to join Sense"
				className={MOBBIN_OTHER_PLANS_SECTION_CLASS}
			>
				<article className={MOBBIN_OTHER_PLANS_ARTICLE_CLASS}>
					<MobbinOtherPlanIcon>
						<Tag className="size-6" strokeWidth={1.6} />
					</MobbinOtherPlanIcon>
					<h3 className={MOBBIN_OTHER_PLANS_TITLE_CLASS}>
						{MOBBIN_FRIEND_INVITE_TITLE}
					</h3>

					{statusLoading ? (
						<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
							Apply it for <span className="whitespace-nowrap">10% off</span>{" "}
							your first Attuned or Immersed plan.
						</p>
					) : status?.canApplyReferralCode ? (
						<>
							<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
								Apply it for <span className="whitespace-nowrap">10% off</span>{" "}
								your first Attuned or Immersed plan — including if you joined
								before Invite &amp; earn.
							</p>
							{applyFormOpen ? (
								<form
									className="flex w-full max-w-xs flex-col items-center gap-y-2 pt-1"
									onSubmit={(event) => {
										event.preventDefault();
										void handleApplyReferral();
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
										onChange={(event) => setReferralCode(event.target.value)}
										className={cn(
											"h-10 w-full rounded-xl bg-card px-3 text-center text-foreground text-sm outline-none",
											"placeholder:text-muted-foreground",
										)}
									/>
									<button
										type="submit"
										disabled={applyLoading || !referralCode.trim()}
										className={cn(
											MOBBIN_OTHER_PLANS_LINK_CLASS,
											"disabled:cursor-not-allowed disabled:opacity-50",
										)}
									>
										{applyLoading ? "Applying…" : "Apply code"}
									</button>
								</form>
							) : (
								<button
									type="button"
									onClick={() => setApplyFormOpen(true)}
									className={MOBBIN_OTHER_PLANS_LINK_CLASS}
								>
									Apply invite code
								</button>
							)}
						</>
					) : status?.referralDiscountEligible ? (
						<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
							Your friend invite is linked.{" "}
							<span className="whitespace-nowrap">10% off</span> applies at
							checkout on Attuned or Immersed.
						</p>
					) : status?.referralDiscountRedeemed ? (
						<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
							You&apos;ve already used your friend invite discount on a
							subscription.
						</p>
					) : (
						<>
							<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
								Apply it for <span className="whitespace-nowrap">10% off</span>{" "}
								your first Attuned or Immersed plan — including if you joined
								before Invite &amp; earn.
							</p>
							{applyFormOpen ? (
								<form
									className="flex w-full max-w-xs flex-col items-center gap-y-2 pt-1"
									onSubmit={(event) => {
										event.preventDefault();
										void handleApplyReferral();
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
										onChange={(event) => setReferralCode(event.target.value)}
										className={cn(
											"h-10 w-full rounded-xl bg-card px-3 text-center text-foreground text-sm outline-none",
											"placeholder:text-muted-foreground",
										)}
									/>
									<button
										type="submit"
										disabled={applyLoading || !referralCode.trim()}
										className={cn(
											MOBBIN_OTHER_PLANS_LINK_CLASS,
											"disabled:cursor-not-allowed disabled:opacity-50",
										)}
									>
										{applyLoading ? "Applying…" : "Apply code"}
									</button>
								</form>
							) : (
								<button
									type="button"
									onClick={() => setApplyFormOpen(true)}
									className={MOBBIN_OTHER_PLANS_LINK_CLASS}
								>
									Apply invite code
								</button>
							)}
						</>
					)}
				</article>

				<article className={MOBBIN_OTHER_PLANS_ARTICLE_CLASS}>
					<MobbinOtherPlanIcon>
						<Gift className="size-6" strokeWidth={1.6} />
					</MobbinOtherPlanIcon>
					<h3 className={MOBBIN_OTHER_PLANS_TITLE_CLASS}>Invite &amp; earn</h3>
					<p className={MOBBIN_OTHER_PLANS_BODY_CLASS}>
						Share Sense with friends — they get{" "}
						<span className="whitespace-nowrap">10% off</span> their first paid
						plan and you unlock milestone rewards as they join.
					</p>
					<button
						type="button"
						onClick={openInviteEarnDialog}
						className={MOBBIN_OTHER_PLANS_LINK_CLASS}
					>
						Invite friends
					</button>
				</article>
			</section>
		</div>
	);
}
