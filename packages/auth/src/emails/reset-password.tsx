import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

export function ResetPasswordEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Reset password"
			footer="If you didn't ask to reset your password, you can ignore this email."
			preview="Reset your Sense password"
			title="Reset your password"
		>
			<Text style={{ margin: 0 }}>
				We received a request to reset the password for your Sense account.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 1 hour.
			</Text>
		</AuthEmailLayout>
	);
}
