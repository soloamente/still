"use client";

import { create } from "zustand";

import { InviteEarnDialog } from "@/components/referrals/invite-earn-dialog";

type InviteEarnDialogStore = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
};

export const useInviteEarnDialog = create<InviteEarnDialogStore>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));

/** Open the global Invite & earn modal — header button and Settings share this entry. */
export function openInviteEarnDialog(): void {
	useInviteEarnDialog.getState().open();
}

/** Mounted once in `AppShell`; fetches referral data when opened. */
export function InviteEarnDialogRoot() {
	const { isOpen, close } = useInviteEarnDialog();

	return <InviteEarnDialog open={isOpen} onClose={close} />;
}
