import { AuthEmailLayout, AuthEmailParagraph } from "./layout";

/**
 * Verification email — sent after sign-up; link expires in 24 hours.
 * `email` is optional so a resend that lacks it still reads correctly.
 */
export function VerifyEmail({ url, email }: { url: string; email?: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Confirm email"
			expires="24 hours"
			footer="If you didn't create a Sense account, you can ignore this email."
			kicker="Verify email"
			preview="One tap to confirm your email and finish setting up Sense."
			title="Confirm your email"
		>
			<AuthEmailParagraph>
				{email
					? `Welcome to Sense. Confirm ${email} to finish setting up your account.`
					: "Welcome to Sense. Confirm your email to finish setting up your account."}
			</AuthEmailParagraph>
			<AuthEmailParagraph muted>
				You'll need this before sharing reviews, lists, or your profile
				publicly.
			</AuthEmailParagraph>
		</AuthEmailLayout>
	);
}
