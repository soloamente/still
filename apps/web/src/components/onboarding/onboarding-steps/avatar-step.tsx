"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useCallback } from "react";
import { toast } from "sonner";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { assertProfilePortraitUploadAllowed } from "@/lib/profile-media";
import { assertProfileMediaUploadSize } from "@/lib/profile-media-cache-key";

type AvatarStepProps = {
	avatarPreviewUrl: string | null;
	onAvatarFile: (file: File) => void;
	isPro?: boolean;
};

/** Step 1 — optional portrait; staged locally until finish uploads to Blob. */
export function AvatarStep({
	avatarPreviewUrl,
	onAvatarFile,
	isPro = false,
}: AvatarStepProps) {
	const handleFile = useCallback(
		(file: File | undefined) => {
			if (!file?.type.startsWith("image/")) return;
			try {
				assertProfileMediaUploadSize(file);
				assertProfilePortraitUploadAllowed(file, isPro);
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Image must be 4MB or smaller",
				);
				return;
			}
			onAvatarFile(file);
		},
		[isPro, onAvatarFile],
	);

	const onInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			handleFile(e.target.files?.[0]);
			// Allow re-picking the same file after a rejected GIF attempt.
			e.target.value = "";
		},
		[handleFile],
	);

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			handleFile(e.dataTransfer.files[0]);
		},
		[handleFile],
	);

	return (
		<div className="flex flex-col gap-4">
			<OnboardingStepHeader
				description="Upload a photo to personalize your profile."
				title="Add your portrait"
			/>

			<AnimatePresence mode="wait">
				{avatarPreviewUrl ? (
					<motion.div
						key="avatar-preview"
						animate={{ opacity: 1, scale: 1 }}
						className="group relative mx-auto size-32 cursor-pointer overflow-hidden rounded-full"
						exit={{ opacity: 0, scale: 0.9 }}
						initial={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.2 }}
					>
						<Image
							alt="Portrait preview"
							className="size-full object-cover transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-110"
							height={128}
							src={avatarPreviewUrl}
							unoptimized
							width={128}
						/>
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
							<span className="font-medium text-sm text-white">Change</span>
						</div>
						<input
							accept="image/*"
							className="absolute inset-0 size-full cursor-pointer opacity-0"
							onChange={onInputChange}
							type="file"
						/>
					</motion.div>
				) : (
					<motion.div
						key="avatar-upload"
						animate={{ opacity: 1 }}
						className={cn(
							"relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-muted/60 border-dashed p-8",
							"[@media(hover:hover)]:hover:border-foreground/30",
						)}
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						onDragOver={(e) => e.preventDefault()}
						onDrop={onDrop}
						transition={{ duration: 0.2 }}
					>
						<input
							accept="image/*"
							className="absolute inset-0 size-full cursor-pointer opacity-0"
							onChange={onInputChange}
							type="file"
						/>
						<div className="flex size-20 items-center justify-center rounded-full bg-muted/40">
							<span className="text-3xl text-muted-foreground">+</span>
						</div>
						<div className="space-y-1 text-center">
							<p className="text-foreground text-sm">Drag and drop an image</p>
							<p className="text-muted-foreground text-xs">
								or click to browse
							</p>
							{!isPro ? (
								<p className="text-muted-foreground text-xs">
									GIF portraits require Sense Pro.
								</p>
							) : null}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
