import type { ReactNode } from "react";

import { appShellMainContentMinHeightStyle } from "@/components/app/app-shell";
import { VAUL_DRAWER_WRAPPER_ATTR } from "@/lib/detail-vaul-drawer";

/**
 * Minimal chrome for signed-out film/TV/profile pages — enough structure for
 * crawlers and visitors to read real page content without the authenticated shell.
 */
export function PublicShareShell({ children }: { children: ReactNode }) {
	return (
		<div
			className="relative flex min-h-svh flex-col bg-background"
			{...{ [VAUL_DRAWER_WRAPPER_ATTR]: "" }}
		>
			<main
				id="main-content"
				className="relative z-[36] flex min-h-svh flex-1 flex-col px-2.5 pt-0"
				style={appShellMainContentMinHeightStyle}
			>
				{children}
			</main>
		</div>
	);
}
