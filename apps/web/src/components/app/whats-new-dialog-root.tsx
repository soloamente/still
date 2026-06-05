"use client";

import { useCallback, useEffect, useState } from "react";

import { WhatsNewDialog } from "@/components/app/whats-new-dialog";
import { getActiveWhatsNewRelease } from "@/lib/whats-new-releases";
import {
	markWhatsNewSeen,
	shouldShowWhatsNewRelease,
} from "@/lib/whats-new-seen";

const OPEN_DELAY_MS = 400;

/** Shows the release carousel once per patron after they enter the authenticated app. */
export function WhatsNewDialogRoot({ userId }: { userId: string }) {
	const release = getActiveWhatsNewRelease();
	const [open, setOpen] = useState(false);

	const dismiss = useCallback(() => {
		if (release) markWhatsNewSeen(userId, release.id);
		setOpen(false);
	}, [release, userId]);

	useEffect(() => {
		if (!release) return;
		if (!shouldShowWhatsNewRelease(userId, release.id)) return;

		const timeoutId = window.setTimeout(() => {
			setOpen(true);
		}, OPEN_DELAY_MS);

		return () => window.clearTimeout(timeoutId);
	}, [release, userId]);

	if (!release) return null;

	return <WhatsNewDialog open={open} release={release} onDismiss={dismiss} />;
}
