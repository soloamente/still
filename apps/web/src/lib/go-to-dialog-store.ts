import { create } from "zustand";

/** Lightweight launcher dialog — separate from the heavy catalog search sheet. */
type GoToDialogStore = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

export const useGoToDialog = create<GoToDialogStore>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
