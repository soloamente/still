"use client";

import { useContext } from "react";

import {
	PatronEntitlementsContext,
	type PatronEntitlementsContextValue,
} from "@/components/plans/patron-entitlements-provider";

/** Read patron tier + feature gates from app layout context. */
export function usePatronEntitlements(): PatronEntitlementsContextValue {
	const ctx = useContext(PatronEntitlementsContext);
	if (!ctx) {
		throw new Error(
			"usePatronEntitlements must be used within PatronEntitlementsProvider",
		);
	}
	return ctx;
}

/** Optional hook — returns null outside signed-in app shell. */
export function usePatronEntitlementsOptional(): PatronEntitlementsContextValue | null {
	return useContext(PatronEntitlementsContext);
}
