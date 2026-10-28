import { AuthEmailLayout, AuthEmailParagraph } from "./layout";

/** Password reset — link expires in 1 hour (see `resetPasswordTokenExpiresIn`). */
export function ResetPasswordEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Choose a new password"
			expires="1 hour"
			footer="If you didn't ask to reset your password, you can ignore this email — your password stays the same."
			kicker="Password reset"
			preview="Use this link to choose a new Sense password."
			title="Reset your password"
		>
			<AuthEmailParagraph>
				We received a request to reset the password for your Sense account.
			</AuthEmailParagraph>
			<AuthEmailParagraph muted>
				Choose a new one with the button below.
			</AuthEmailParagraph>
		</AuthEmailLayout>
	);
}
