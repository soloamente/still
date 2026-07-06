import { stillApiOrigin } from "@/lib/still-api-origin";

export type CheckoutDiscountResponse = {
	discountId: string | null;
	eligible: boolean;
};

/** Referral 10% discount id for Polar checkout when the patron is eligible. */
export async function fetchCheckoutDiscountClient(): Promise<CheckoutDiscountResponse> {
	const response = await fetch(
		`${stillApiOrigin()}/api/plans/checkout-discount`,
		{
			credentials: "include",
			cache: "no-store",
		},
	);

	if (!response.ok) {
		if (response.status === 401) {
			return { discountId: null, eligible: false };
		}
		throw new Error("Could not load checkout discount");
	}

	return (await response.json()) as CheckoutDiscountResponse;
}
