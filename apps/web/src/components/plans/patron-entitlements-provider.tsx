"use client";

import { createContext, type ReactNode, useMemo } from "react";

import {
	buildPatronEntitlementsFromProfile,
	type PatronEntitlementsSnapshot,
	type PlanFeatureKey,
	type PlanTierId,
} from "@/lib/patron-entitlements";

export type PatronEntitlementsContextValue = {
	effectiveTier: PlanTierId;
	featureGrants: readonly PlanFeatureKey[];
	hasFeature: (featureKey: PlanFeatureKey) => boolean;
	/** @deprecated compat shim — equals hasFeature("all_themes") */
	isPro: boolean;
};

const PatronEntitlementsContext =
	createContext<PatronEntitlementsContextValue | null>(null);

export function PatronEntitlementsProvider({
	effectiveTier,
	featureGrants,
	isPro,
	hasFeature,
	children,
}: PatronEntitlementsContextValue & { children: ReactNode }) {
	const value = useMemo(
		() => ({
			effectiveTier,
			featureGrants,
			hasFeature,
			isPro,
		}),
		[effectiveTier, featureGrants, hasFeature, isPro],
	);

	return (
		<PatronEntitlementsContext.Provider value={value}>
			{children}
		</PatronEntitlementsContext.Provider>
	);
}

/** Seed provider from server-resolved profile entitlement fields. */
export function PatronEntitlementsProviderFromProfile({
	profile,
	children,
}: {
	profile: Parameters<typeof buildPatronEntitlementsFromProfile>[0];
	children: ReactNode;
}) {
	const snapshot: PatronEntitlementsSnapshot =
		buildPatronEntitlementsFromProfile(profile);

	return (
		<PatronEntitlementsProvider
			effectiveTier={snapshot.effectiveTier}
			featureGrants={snapshot.featureGrants}
			hasFeature={snapshot.hasFeature}
			isPro={snapshot.isPro}
		>
			{children}
		</PatronEntitlementsProvider>
	);
}

export { PatronEntitlementsContext };
