/**
 * Sole-trader identity shown on public legal pages.
 * Fill REPLACE_ME_* values before paid launch (Task 10 / operator checklist).
 * Do not invent a fake address — leave placeholders until real details are ready.
 */

import { APP_NAME } from "@/lib/app-brand";

export type LegalTrader = {
	/** Product name shown in headings. */
	productName: string;
	/** Sole trader legal name (public). */
	legalName: string;
	/** Full home / registered address lines (public). */
	addressLines: string[];
	/** Privacy / support contact email. */
	email: string;
	/** ISO date string (YYYY-MM-DD) for “Last updated”. */
	lastUpdated: string;
	/**
	 * Canonical public origin for legal copy (no trailing slash).
	 * Prefer the live production host patrons actually use.
	 */
	publicOrigin: string;
};

export const LEGAL_TRADER: LegalTrader = {
	productName: APP_NAME,
	legalName: "Anselmo Diogo Guatta Vicente",
	addressLines: ["Via Elia Capriolo 17/B", "25122 Brescia, Italy"],
	email: "contatta.av@gmail.com",
	lastUpdated: "2026-10-08",
	publicOrigin: "https://cinema.sense.fans",
};

/** True when a trader field still contains an operator placeholder token. */
export function isLegalTraderPlaceholder(value: string): boolean {
	return value.includes("REPLACE_ME");
}

/** True when any required trader field still needs operator fill-in. */
export function isLegalTraderIncomplete(
	trader: LegalTrader = LEGAL_TRADER,
): boolean {
	if (isLegalTraderPlaceholder(trader.legalName)) return true;
	if (isLegalTraderPlaceholder(trader.email)) return true;
	if (trader.addressLines.some((line) => isLegalTraderPlaceholder(line))) {
		return true;
	}
	return false;
}

/**
 * Dev/ops helper — throws when placeholders remain.
 * Do not call from request paths that must stay up with placeholders.
 */
export function assertLegalTraderReady(
	trader: LegalTrader = LEGAL_TRADER,
): void {
	if (isLegalTraderIncomplete(trader)) {
		throw new Error(
			"LEGAL_TRADER still contains REPLACE_ME placeholders. Fill before paid launch.",
		);
	}
}
