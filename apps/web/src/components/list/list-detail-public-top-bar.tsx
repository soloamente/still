"use client";

import IconShareIn from "@still/ui/icons/share-in";
import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { APP_NAME } from "@/lib/app-brand";
import { listShareCopiedToastMessage } from "@/lib/list-share-toast";

/**
 * Public list detail header — back to marketing home; share uses the SEO `/l/` URL.
 */
export function ListDetailPublicTopBar({
	title,
	sharePath,
}: {
	title: string;
	sharePath: string;
}) {
	const [isScrolled, setIsScrolled] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	async function handleShare() {
		const href =
			typeof window !== "undefined"
				? `${window.location.origin}${sharePath}`
				: sharePath;

		try {
			await navigator.clipboard.writeText(href);
			setShareCopied(true);
			toast.success(listShareCopiedToastMessage(title));
			window.setTimeout(() => setShareCopied(false), 1600);
		} catch {
			toast.error("Couldn't copy link");
		}
	}

	return (
		<header
			className={cn(
				"sticky top-0 z-30 w-full overflow-visible bg-background",
				"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
				isScrolled && "after:opacity-100",
			)}
		>
			<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink href="/" className={cn(pill, "max-w-full pl-3")}>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="truncate">{APP_NAME}</span>
					</DetailMotionLink>
				</div>
				<p className="max-w-[min(100%,12rem)] truncate text-center font-medium text-foreground text-sm sm:max-w-xs">
					{title}
				</p>
				<div className="flex min-w-0 justify-end">
					<DetailMotionButton
						type="button"
						className={cn(pill, "pr-3")}
						onClick={() => void handleShare()}
						aria-label={shareCopied ? "Link copied" : `Copy link for ${title}`}
						iconSwapKey={shareCopied ? "copied" : "share"}
					>
						{shareCopied ? "Copied" : "Share"}
						{shareCopied ? (
							<Check className="size-4 shrink-0 opacity-90" aria-hidden />
						) : (
							<IconShareOut size="20px" className="shrink-0 opacity-90" />
						)}
					</DetailMotionButton>
				</div>
			</div>
		</header>
	);
}
