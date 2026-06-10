import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { APP_NAME } from "@/lib/app-brand";

export const metadata: Metadata = {
	title: "Reset password",
	description: `Choose a new password for your ${APP_NAME} account.`,
};

export default function ResetPasswordPage() {
	return <ResetPasswordForm />;
}
