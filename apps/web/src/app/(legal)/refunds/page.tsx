import { permanentRedirect } from "next/navigation";

/**
 * Legacy `/refunds` URL — refunds live inside Terms of Service.
 * Hash is client-only; server redirect lands on `/terms`.
 */
export default function RefundsPage() {
	// Fragment hashes are not preserved on HTTP redirects; land on Terms.
	permanentRedirect("/terms");
}
