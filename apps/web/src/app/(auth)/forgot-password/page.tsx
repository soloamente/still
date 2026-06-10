import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { APP_NAME } from "@/lib/app-brand";

export const metadata: Metadata = {
	title: "Forgot password",
	description: `Reset your ${APP_NAME} password via email.`,
};

export default function ForgotPasswordPage() {
	return <ForgotPasswordForm />;
}
