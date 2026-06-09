"use client";

import { Button } from "@still/ui/components/button";
import { MailCheck } from "lucide-react";
import { useState } from "react";

import { MeClearLibraryDialog } from "@/components/profile/me-clear-library-dialog";
import { MeDeleteAccountDialog } from "@/components/profile/me-delete-account-dialog";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";

type OpenDialog = "clear" | "delete" | null;

/** Data settings danger zone — clear library + delete account. */
export function MeDangerZone() {
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
	const [clearedAt, setClearedAt] = useState<Date | null>(null);
	const [deletionEmailSent, setDeletionEmailSent] = useState(false);

	return (
		<MeSettingsSection
			title="Danger zone"
			description="Destructive actions — both ask you to confirm, and account deletion is verified by email."
		>
			<MeSettingsPanel className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="max-w-prose">
						<p className="font-medium text-foreground text-sm">
							Clear library data
						</p>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							Remove your diary, ratings, watchlist, TV progress, streaks, and
							badges. Reviews, lists, and followers stay.
						</p>
						{clearedAt ? (
							<p className="mt-1 text-emerald-500 text-sm">Library cleared.</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className="bg-background text-destructive"
						onClick={() => setOpenDialog("clear")}
					>
						Clear library…
					</Button>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="max-w-prose">
						<p className="font-medium text-foreground text-sm">
							Delete account
						</p>
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							Permanently delete your account and everything in it. Confirmed by
							a link sent to your email.
						</p>
						{deletionEmailSent ? (
							<p className="mt-1 flex items-center gap-1.5 text-foreground text-sm">
								<MailCheck className="size-4" aria-hidden />
								Check your inbox — the deletion link expires in 24 hours.
							</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className="bg-background text-destructive"
						onClick={() => setOpenDialog("delete")}
					>
						Delete account…
					</Button>
				</div>
			</MeSettingsPanel>

			<MeClearLibraryDialog
				open={openDialog === "clear"}
				onClose={() => setOpenDialog(null)}
				onCleared={() => setClearedAt(new Date())}
				onExportFirst={() => {
					setOpenDialog(null);
					document
						.getElementById("me-data-export-panel")
						?.scrollIntoView({ behavior: "smooth", block: "center" });
				}}
			/>
			<MeDeleteAccountDialog
				open={openDialog === "delete"}
				onClose={() => setOpenDialog(null)}
				onEmailSent={() => setDeletionEmailSent(true)}
			/>
		</MeSettingsSection>
	);
}
