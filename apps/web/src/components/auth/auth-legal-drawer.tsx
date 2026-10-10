"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import { LegalPolicyDrawer } from "@/components/legal/legal-policy-drawer";
import type { LegalPolicyId } from "@/lib/legal-policy-bodies";

type AuthLegalDrawerContextValue = {
	openPolicy: (id: LegalPolicyId) => void;
};

const AuthLegalDrawerContext =
	createContext<AuthLegalDrawerContextValue | null>(null);

/**
 * Keeps Privacy / Terms on the auth route as a Vaul overlay so the film
 * backdrop stays behind the scrim (navigating to `/privacy` wiped it).
 */
export function AuthLegalDrawerProvider({ children }: { children: ReactNode }) {
	const [policyId, setPolicyId] = useState<LegalPolicyId>("privacy");
	const [open, setOpen] = useState(false);

	const openPolicy = useCallback((id: LegalPolicyId) => {
		setPolicyId(id);
		setOpen(true);
	}, []);

	const value = useMemo(() => ({ openPolicy }), [openPolicy]);

	return (
		<AuthLegalDrawerContext.Provider value={value}>
			{children}
			<LegalPolicyDrawer
				policyId={policyId}
				open={open}
				onOpenChange={setOpen}
				onSelectPolicy={(id) => {
					setPolicyId(id);
					setOpen(true);
				}}
			/>
		</AuthLegalDrawerContext.Provider>
	);
}

export function useAuthLegalDrawer(): AuthLegalDrawerContextValue {
	const ctx = useContext(AuthLegalDrawerContext);
	if (!ctx) {
		throw new Error(
			"useAuthLegalDrawer must be used within AuthLegalDrawerProvider",
		);
	}
	return ctx;
}

/** Optional — sign-up helper links work outside the provider via full navigation. */
export function useOptionalAuthLegalDrawer(): AuthLegalDrawerContextValue | null {
	return useContext(AuthLegalDrawerContext);
}
