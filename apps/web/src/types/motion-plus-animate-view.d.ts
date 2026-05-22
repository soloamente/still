/**
 * Optional Motion+ module — install with:
 * `bun add "https://api.motion.dev/registry?package=motion-plus&version=2.0.0-alpha.4&token=YOUR_AUTH_TOKEN"`
 */
declare module "motion-plus/animate-view" {
	import type { ReactNode } from "react";

	export function AnimateView(props: {
		name: string;
		update?: Record<string, unknown>;
		children: ReactNode;
	}): ReactNode;
}
