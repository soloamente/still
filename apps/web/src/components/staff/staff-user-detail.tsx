"use client";

import type { PlanFeatureKey, PlanTierId } from "@still/plans";
import { Button } from "@still/ui/components/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";
import { roleLabel } from "@/lib/staff-role-labels";

import {
	type StaffEditableProfile,
	StaffUserEditForm,
} from "./staff-user-edit-form";
import { type StaffUserNote, StaffUserNotes } from "./staff-user-notes";
import { StaffUserPlanForm } from "./staff-user-plan-form";

type StaffUserDetailData = {
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		emailVerified?: boolean | null;
		role?: string | null;
		banned?: boolean | null;
		createdAt?: string | null;
	};
	profile:
		| (StaffEditableProfile & {
				userId: string;
				subscriptionTier: PlanTierId;
				planOverride: PlanTierId | null;
				effectiveTier: PlanTierId;
				featureGrants: PlanFeatureKey[];
				isPro: boolean;
				isPrivate: boolean;
				statsCache?: {
					filmsLogged?: number;
					thisYear?: number;
					following?: number;
					followers?: number;
					reviewsCount?: number;
					listsCount?: number;
				} | null;
		  })
		| null;
	permissions: Array<{ resource: string; action: string; label: string }>;
};

const TIER_LABELS: Record<PlanTierId, string> = {
	still: "Still",
	attuned: "Attuned",
	immersed: "Immersed",
	devoted: "Devoted",
};

function formatDate(value?: string | null): string {
	if (!value) return "";
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/**
 * Expanded detail panel for a single user row in the staff Users tab.
 * Fetches GET /api/staff/users/:id on mount and lazy-loads notes when the
 * viewer holds `user:note`.
 */
export function StaffUserDetail({
	userId,
	canEdit,
	canNote,
	canPro,
	canImpersonate,
}: {
	userId: string;
	canEdit: boolean;
	canNote: boolean;
	canPro: boolean;
	canImpersonate: boolean;
}) {
	const [data, setData] = useState<StaffUserDetailData | null>(null);
	const [notes, setNotes] = useState<StaffUserNote[]>([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(false);
	const [impersonating, setImpersonating] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const detailRes = await api.api.staff.users({ id: userId }).get();
				if (cancelled) return;
				if (detailRes.error) {
					toast.error(
						errorMessage(detailRes.error.value, "Could not load user"),
					);
				} else {
					setData(detailRes.data as StaffUserDetailData);
				}

				if (canNote) {
					const notesRes = await api.api.staff
						.users({ id: userId })
						.notes.get();
					if (!cancelled && !notesRes.error) {
						const nd = notesRes.data as { notes: StaffUserNote[] } | null;
						setNotes(nd?.notes ?? []);
					}
				}
			} catch (err) {
				if (!cancelled) {
					toast.error(errorMessage(err, "Could not load user"));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, canNote]);

	async function handleImpersonate() {
		setImpersonating(true);
		try {
			const res = await api.api.staff.users({ id: userId }).impersonate.post();
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not start impersonation"),
				);
				return;
			}
			toast.success("Impersonating — redirecting…");
			window.location.href = "/home";
		} catch (err) {
			toast.error(errorMessage(err, "Could not start impersonation"));
		} finally {
			setImpersonating(false);
		}
	}

	if (loading) {
		return <p className="px-4 py-3 text-muted-foreground text-sm">Loading…</p>;
	}
	if (!data) {
		return (
			<p className="px-4 py-3 text-muted-foreground text-sm">
				Could not load this user.
			</p>
		);
	}

	const { user, profile, permissions } = data;

	return (
		<div className="space-y-6 border-border border-t bg-muted/10 px-4 py-4">
			<section className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<p>
						<span className="text-muted-foreground">Email:</span>{" "}
						{user.email ?? "—"}
						{user.emailVerified ? (
							<span className="ml-1 text-muted-foreground text-xs">
								(verified)
							</span>
						) : (
							<span className="ml-1 text-muted-foreground text-xs">
								(unverified)
							</span>
						)}
					</p>
					<p>
						<span className="text-muted-foreground">Role:</span>{" "}
						{roleLabel(user.role ?? "user")}
					</p>
					<p>
						<span className="text-muted-foreground">Joined:</span>{" "}
						{formatDate(user.createdAt)}
					</p>
					<p>
						<span className="text-muted-foreground">Status:</span>{" "}
						{user.banned ? "Banned" : "Active"}
					</p>
					{profile ? (
						<>
							<p>
								<span className="text-muted-foreground">Handle:</span>{" "}
								<a
									href={`/profile/${profile.handle}`}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2"
								>
									@{profile.handle}
								</a>
							</p>
							<p className="flex flex-wrap gap-1.5">
								<span className="rounded-full border border-border px-2 py-0.5 text-xs">
									{TIER_LABELS[profile.effectiveTier]}
								</span>
								{profile.planOverride ? (
									<span className="rounded-full border border-border px-2 py-0.5 text-xs">
										Override
									</span>
								) : null}
								{profile.isPrivate ? (
									<span className="rounded-full border border-border px-2 py-0.5 text-xs">
										Private
									</span>
								) : null}
							</p>
							<p className="text-muted-foreground text-xs">
								{profile.statsCache?.filmsLogged ?? 0} films logged ·{" "}
								{profile.statsCache?.reviewsCount ?? 0} reviews ·{" "}
								{profile.statsCache?.listsCount ?? 0} lists ·{" "}
								{profile.statsCache?.followers ?? 0} followers ·{" "}
								{profile.statsCache?.following ?? 0} following
							</p>
						</>
					) : null}
				</div>
				<div className="space-y-2 text-sm">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Permissions for {roleLabel(user.role ?? "user")}
					</p>
					<ul className="flex flex-wrap gap-1.5">
						{permissions.map((p) => (
							<li
								key={`${p.resource}:${p.action}`}
								className="rounded-full border border-border px-2 py-0.5 text-xs"
							>
								{p.label}
							</li>
						))}
					</ul>
				</div>
			</section>

			{canPro && profile ? (
				<StaffUserPlanForm
					userId={userId}
					subscriptionTier={profile.subscriptionTier}
					planOverride={profile.planOverride}
					effectiveTier={profile.effectiveTier}
					featureGrants={profile.featureGrants}
					onSaved={(entitlements) => {
						setData((prev) =>
							prev?.profile
								? {
										...prev,
										profile: {
											...prev.profile,
											...entitlements,
										},
									}
								: prev,
						);
					}}
				/>
			) : null}

			{canEdit && profile ? (
				<section>
					{editing ? (
						<StaffUserEditForm
							userId={userId}
							profile={profile}
							onCancel={() => setEditing(false)}
							onSaved={(updated) => {
								setData((prev) =>
									prev?.profile
										? { ...prev, profile: { ...prev.profile, ...updated } }
										: prev,
								);
								setEditing(false);
							}}
						/>
					) : (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => setEditing(true)}
						>
							Edit profile
						</Button>
					)}
				</section>
			) : null}

			{canNote ? (
				<section>
					<StaffUserNotes
						userId={userId}
						notes={notes}
						canNote={canNote}
						onNoteAdded={(note) => setNotes((prev) => [note, ...prev])}
					/>
				</section>
			) : null}

			{canImpersonate ? (
				<section>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={impersonating}
						onClick={handleImpersonate}
					>
						{impersonating ? "Starting…" : "Impersonate this user"}
					</Button>
				</section>
			) : null}
		</div>
	);
}
