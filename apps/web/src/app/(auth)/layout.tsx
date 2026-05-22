import type { ReactNode } from "react";
import { AuthRouteLayout } from "@/components/auth/auth-route-layout";

/** Persistent auth chrome; pages render only the form column. */
export default function AuthLayout({ children }: { children: ReactNode }) {
	return <AuthRouteLayout>{children}</AuthRouteLayout>;
}
