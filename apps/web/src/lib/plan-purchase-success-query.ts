export type PlanPurchaseSuccessQuery = {
	isSuccess: boolean;
	checkoutId: string | null;
};

/** Read Polar checkout return flags from location search string. */
export function parsePlanPurchaseSuccessQuery(
	search: string,
): PlanPurchaseSuccessQuery {
	const normalized = search.startsWith("?") ? search.slice(1) : search;
	const params = new URLSearchParams(normalized);
	const checkoutIdRaw = params.get("checkout_id")?.trim() ?? "";
	return {
		isSuccess: params.get("checkout") === "success",
		checkoutId: checkoutIdRaw.length > 0 ? checkoutIdRaw : null,
	};
}

/** Remove checkout query params after the success dialog opens. */
export function stripPlanPurchaseSuccessParams(
	pathname: string,
	search: string,
): string {
	const normalized = search.startsWith("?") ? search.slice(1) : search;
	const params = new URLSearchParams(normalized);
	params.delete("checkout");
	params.delete("checkout_id");
	const next = params.toString();
	return next.length > 0 ? `${pathname}?${next}` : pathname;
}
