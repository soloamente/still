import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";
import { LEGAL_SUBPROCESSORS } from "@/lib/legal-subprocessors";

/** Trust Center body — vendors list (hero title lives in the shared document shell). */
export function LegalTrustContent() {
	return (
		<div className="w-full">
			<p className="text-pretty text-foreground/90 text-lg leading-6">
				Vendors and subprocessors that may handle personal data when you use{" "}
				{APP_NAME}. This list may change as we change infrastructure. See the{" "}
				<Link
					href="/privacy"
					className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
				>
					Privacy Policy
				</Link>{" "}
				for how we collect and use data.
			</p>

			<ul className="mt-16 space-y-10">
				{LEGAL_SUBPROCESSORS.map((row) => (
					<li key={row.name}>
						<h2 className="font-sans font-semibold text-[2rem] text-foreground leading-9 tracking-tight">
							{row.name}
						</h2>
						<p className="mt-4 text-pretty text-foreground text-lg leading-6">
							{row.purpose}
						</p>
					</li>
				))}
			</ul>
		</div>
	);
}
