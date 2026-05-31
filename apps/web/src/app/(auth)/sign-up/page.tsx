import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { APP_NAME } from "@/lib/app-brand";

export const metadata: Metadata = {
	title: "Create your account",
	description: `Join ${APP_NAME} — log films and TV, build lists, and follow friends.`,
};

export default function SignUpPage() {
	return <SignUpForm />;
}
