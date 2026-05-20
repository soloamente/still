"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

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
	setActions: (next: MeAccountBarActions | null) => void;
};

const MeAccountBarActionsContext =
	createContext<MeAccountBarActionsContextValue | null>(null);

export function MeAccountBarActionsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [actions, setActions] = useState<MeAccountBarActions | null>(null);
	const value = useMemo(() => ({ actions, setActions }), [actions]);
	return (
		<MeAccountBarActionsContext.Provider value={value}>
			{children}
		</MeAccountBarActionsContext.Provider>
	);
}

/**
 * Register Save/Cancel for the sticky account top bar. Clear on unmount so
 * other `/me/*` routes do not inherit stale handlers.
 */
export function useRegisterMeAccountBarActions(
	actions: MeAccountBarActions | null,
) {
	const ctx = useContext(MeAccountBarActionsContext);
	const setActions = ctx?.setActions;

	useEffect(() => {
		if (!setActions) return;
		setActions(actions);
		return () => {
			setActions(null);
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
