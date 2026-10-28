import { AuthEmailLayout, AuthEmailParagraph } from "./layout";

/** Account deletion confirmation — destructive tone; link expires in 24 hours. */
export function DeleteAccountEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Permanently delete account"
			expires="24 hours"
			footer="If you didn't request account deletion, ignore this email — nothing will happen."
			kicker="Account deletion"
			preview="Confirm to permanently delete your Sense account."
			title="Confirm account deletion"
			tone="danger"
		>
			<AuthEmailParagraph>
				You asked to permanently delete your Sense account. This removes your
				profile, diary, reviews, lists, and followers. There is no undo.
			</AuthEmailParagraph>
			<AuthEmailParagraph muted>
				Changed your mind? Don't open the link and your account stays as it is.
			</AuthEmailParagraph>
		</AuthEmailLayout>
	);
}
