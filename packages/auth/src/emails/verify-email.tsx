import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

/** Verification email — sent after sign-up; link expires in 24 hours. */
export function VerifyEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Confirm email"
			footer="If you didn't create a Sense account, you can ignore this email."
			preview="Confirm your email for Sense"
			title="Confirm your email"
		>
			<Text style={{ margin: 0 }}>
				Tap the button to verify your email. You'll need this before sharing
				reviews, lists, or your profile publicly.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 24 hours.
			</Text>
		</AuthEmailLayout>
	);
}
