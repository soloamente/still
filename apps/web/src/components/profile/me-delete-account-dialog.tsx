"use client";

import { useState } from "react";

import { MeDestructiveConfirmDialog } from "@/components/profile/me-destructive-confirm-dialog";
import { authClient } from "@/lib/auth-client";

/**
 * Delete account (Data settings danger zone). Email-verified: Better Auth
 * sends a deletion link to the account email; the account survives until the
 * patron clicks it. On send we surface a pending state on the panel.
 */
export function MeDeleteAccountDialog({
	open,
	onClose,
	onEmailSent,
}: {
	open: boolean;
	onClose: () => void;
	onEmailSent: () => void;
}) {
	const [isBusy, setIsBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function requestDeletion() {
		setIsBusy(true);
		setError(null);
		try {
			const { error: apiError } = await authClient.deleteUser({
				callbackURL: "/",
			});
			if (apiError) {
				setError(
					apiError.message ??
						"Couldn't start account deletion — please try again.",
				);
				return;
			}
			onEmailSent();
			onClose();
		} catch {
			setError("Couldn't start account deletion — check your connection.");
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<MeDestructiveConfirmDialog
			open={open}
			title="Delete account"
			confirmPhrase="delete my account"
			confirmLabel="Send deletion email"
			busyLabel="Sending…"
			isBusy={isBusy}
			error={error}
			onClose={onClose}
			onConfirm={() => void requestDeletion()}
		>
			<p>
				This permanently deletes your <strong>entire account</strong> — profile,
				diary, reviews, lists, followers, everything. There is no undo.
			</p>
			<p className="mt-2">
				To confirm it's you, we'll email a verification link to your account
				address. Your account is only deleted after you click it. The link
				expires in 24 hours.
			</p>
		</MeDestructiveConfirmDialog>
	);
}
