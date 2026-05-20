"use client";

import type { ReactNode } from "react";

import { MeAccountRevealItem } from "@/components/profile/me-account-content-reveal";

/** Pinned save row — diffusion shadow, no border rings. */
export function MeStickyFormActions({ children }: { children: ReactNode }) {
	return (
		<MeAccountRevealItem>
			<div className="sticky bottom-0 z-10 -mx-6 flex justify-end bg-linear-to-t from-card via-card/95 to-card/0 px-6 pt-8 pb-2 sm:-mx-8 sm:px-8">
				<div className="rounded-full shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]">
					{children}
				</div>
			</div>
		</MeAccountRevealItem>
	);
}
