"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT,
	type MeAccountBarActionsSlot,
	reduceMeAccountBarActionsSlot,
} from "@/components/profile/me-account-bar-actions-slot";

/** Actions rendered in `MeAccountTopBar` (Save / Cancel) — registered by account sub-pages. */
export interface MeAccountBarActions {
	onSave: () => void | Promise<void>;
	onCancel: () => void;
	/** True when there are unsaved edits worth saving. */
	canSave: boolean;
	saving?: boolean;
}

type MeAccountBarActionsContextValue = {
	actions: MeAccountBarActions | null;
	setActions: (next: MeAccountBarActions | null, owner: symbol) => void;
};

const MeAccountBarActionsContext =
	createContext<MeAccountBarActionsContextValue | null>(null);

export function MeAccountBarActionsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [slot, setSlot] = useState(
		EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT as MeAccountBarActionsSlot<MeAccountBarActions>,
	);
	const setActions = useCallback(
		(next: MeAccountBarActions | null, owner: symbol) => {
			setSlot((prev) => reduceMeAccountBarActionsSlot(prev, next, owner));
		},
		[],
	);
	const value = useMemo(
		() => ({ actions: slot.actions, setActions }),
		[slot.actions, setActions],
	);
	return (
		<MeAccountBarActionsContext.Provider value={value}>
			{children}
		</MeAccountBarActionsContext.Provider>
	);
}

/**
 * Register Save/Cancel for the sticky account top bar. Clear on unmount so
 * other `/me/*` routes do not inherit stale handlers — but only if this
 * instance still owns the slot (route-slide exit layers must not wipe the
 * surviving Settings form).
 */
export function useRegisterMeAccountBarActions(
	actions: MeAccountBarActions | null,
) {
	const ctx = useContext(MeAccountBarActionsContext);
	const setActions = ctx?.setActions;
	const ownerRef = useRef(Symbol("me-account-bar-actions"));

	useEffect(() => {
		if (!setActions) return;
		const owner = ownerRef.current;
		setActions(actions, owner);
		return () => {
			setActions(null, owner);
		};
	}, [setActions, actions]);
}

/** Read registered bar actions (used by `MeAccountTopBar`). */
export function useMeAccountBarActions(): {
	actions: MeAccountBarActions | null;
} {
	const ctx = useContext(MeAccountBarActionsContext);
	return { actions: ctx?.actions ?? null };
}
