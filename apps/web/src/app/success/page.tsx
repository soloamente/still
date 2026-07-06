import { redirect } from "next/navigation";

type PageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Polar checkout success landing — matches the default Better Auth / Polar wizard URL.
 * Forwards patrons to /home with success query flags for the thank-you dialog.
 */
export default async function PolarCheckoutSuccessPage({
	searchParams,
}: PageProps) {
	const params = await searchParams;
	const destination = new URLSearchParams({
		checkout: "success",
	});

	const checkoutId = params.checkout_id;
	if (typeof checkoutId === "string" && checkoutId.length > 0) {
		destination.set("checkout_id", checkoutId);
	}

	redirect(`/home?${destination.toString()}`);
}
