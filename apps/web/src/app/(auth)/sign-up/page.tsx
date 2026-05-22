import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
	title: "Create your account",
	description:
		"Join Still — log films and TV, build lists, and follow friends.",
};

export default function SignUpPage() {
	return <SignUpForm />;
}
