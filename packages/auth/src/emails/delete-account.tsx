import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

export function DeleteAccountEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Confirm deletion"
			footer="If you didn't request account deletion, ignore this email — nothing will happen."
			preview="Confirm your Sense account deletion"
			title="Confirm account deletion"
		>
			<Text style={{ margin: 0 }}>
				You asked to permanently delete your Sense account. This removes your
				profile, diary, reviews, lists, and followers. There is no undo.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 24 hours.
			</Text>
		</AuthEmailLayout>
	);
}
