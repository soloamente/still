"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import {
	OnboardingPreviewPanel,
	OnboardingPreviewStrip,
} from "@/components/onboarding/onboarding-preview-panel";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";
import { AvatarStep } from "@/components/onboarding/onboarding-steps/avatar-step";
import { BioStep } from "@/components/onboarding/onboarding-steps/bio-step";
import { DoneStep } from "@/components/onboarding/onboarding-steps/done-step";
import {
	FavoritesStepControls,
	FavoritesStepGridPanel,
	useFavoritesStepData,
} from "@/components/onboarding/onboarding-steps/favorites-step";
import {
	HandleStep,
	isHandleStepReady,
	useHandleAvailability,
} from "@/components/onboarding/onboarding-steps/handle-step";
import { NameStep } from "@/components/onboarding/onboarding-steps/name-step";
import {
	TasteStepControls,
	TasteStepGridPanel,
	useTasteStepData,
} from "@/components/onboarding/onboarding-steps/taste-step";
import { VerifyEmailStep } from "@/components/onboarding/onboarding-steps/verify-email-step";
import { WelcomeStep } from "@/components/onboarding/onboarding-steps/welcome-step";
import { OnboardingWizardLayout } from "@/components/onboarding/onboarding-wizard-layout";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
	EMAIL_VERIFICATION_REQUIRED_CODE,
	EMAIL_VERIFICATION_TOAST,
	isEmailVerificationRequiredError,
} from "@/lib/email-verification-error";
import { runOnboardingFinish } from "@/lib/onboarding-finish";
import { resolveOnboardingResumeStep } from "@/lib/onboarding-gate";
import { canAdvanceOnboardingTaste } from "@/lib/onboarding-taste-state";
import {
	ONBOARDING_FAVORITES_MIN,
	type OnboardingMovie,
	type WizardSkipMode,
	type WizardStep,
} from "@/lib/onboarding-types";
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";

type OnboardingWizardProps = {
	initialDisplayName: string;
	initialHandle: string;
	initialBio: string;
	emailVerified: boolean;
	userEmail: string;
	isPro: boolean;
};

function stepAfterBio(verified: boolean): WizardStep {
	return verified ? "taste" : "verify";
}

function previousStep(
	current: WizardStep,
	skipMode: WizardSkipMode,
): WizardStep | null {
	if (current === "done" || current === "welcome" || current === "verify") {
		return null;
	}
	if (skipMode === "abbreviated") {
		if (current === "name") return "welcome";
		if (current === "handle") return "name";
		return null;
	}
	if (current === "avatar") return "welcome";
	if (current === "name") return "avatar";
	if (current === "handle") return "name";
	if (current === "bio") return "handle";
	if (current === "taste") return "bio";
	if (current === "favorites") return "taste";
	return null;
}

export function OnboardingWizard({
	initialDisplayName,
	initialHandle,
	initialBio,
	emailVerified,
	userEmail,
	isPro,
}: OnboardingWizardProps) {
	const router = useRouter();
	const resumeStep = resolveOnboardingResumeStep(initialHandle);
	const [step, setStep] = useState<WizardStep>(resumeStep);
	const [direction, setDirection] = useState(1);
	const [skipMode, setSkipMode] = useState<WizardSkipMode>("full");
	const [displayName, setDisplayName] = useState(initialDisplayName);
	const [handle, setHandle] = useState(initialHandle);
	const [bio, setBio] = useState(initialBio);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [tasteRatings, setTasteRatings] = useState<Record<number, number>>({});
	const [tasteSkipped, setTasteSkipped] = useState<Set<number>>(
		() => new Set(),
	);
	const [tasteSearchAdds, setTasteSearchAdds] = useState<OnboardingMovie[]>([]);
	const [favorites, setFavorites] = useState<OnboardingMovie[]>([]);
	const [tasteHeadline, setTasteHeadline] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);
	const [isEnteringApp, setIsEnteringApp] = useState(false);
	const [isTypingName, setIsTypingName] = useState(false);
	const [isTypingHandle, setIsTypingHandle] = useState(false);
	const [isTypingBio, setIsTypingBio] = useState(false);

	const handleAvailability = useHandleAvailability(handle, initialHandle);

	const tasteStepModel = useTasteStepData({
		enabled: step === "taste",
		ratings: tasteRatings,
		skipped: tasteSkipped,
		searchAdds: tasteSearchAdds,
		onAddSearchMovie: (movie) => {
			setTasteSearchAdds((current) =>
				current.some((row) => row.id === movie.id)
					? current
					: [...current, movie],
			);
		},
		onMarkUnskipped: (movieId) => {
			setTasteSkipped((current) => {
				const next = new Set(current);
				next.delete(movieId);
				return next;
			});
		},
		onMarkSkipped: (movieId) => {
			setTasteSkipped((current) => new Set(current).add(movieId));
			setTasteRatings((current) => {
				const next = { ...current };
				delete next[movieId];
				return next;
			});
		},
		onRate: (movieId, storedRating) => {
			setTasteSkipped((current) => {
				const next = new Set(current);
				next.delete(movieId);
				return next;
			});
			setTasteRatings((current) => ({
				...current,
				[movieId]: storedRating,
			}));
		},
		onClearRating: (movieId) => {
			setTasteRatings((current) => {
				const next = { ...current };
				delete next[movieId];
				return next;
			});
		},
	});

	useEffect(() => {
		if (step === "verify" && emailVerified) {
			setDirection(1);
			setStep("taste");
		}
	}, [emailVerified, step]);

	useEffect(() => {
		return () => {
			if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
		};
	}, [avatarPreviewUrl]);

	const goTo = useCallback((next: WizardStep, dir: 1 | -1) => {
		setDirection(dir);
		setStep(next);
	}, []);

	const onAvatarFile = useCallback(
		(file: File) => {
			if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
			setAvatarFile(file);
			setAvatarPreviewUrl(URL.createObjectURL(file));
		},
		[avatarPreviewUrl],
	);

	const toggleFavorite = useCallback((movie: OnboardingMovie) => {
		setFavorites((current) => {
			if (current.some((row) => row.id === movie.id)) {
				return current.filter((row) => row.id !== movie.id);
			}
			if (current.length >= 8) return current;
			return [...current, movie];
		});
	}, []);

	const favoritesStepModel = useFavoritesStepData({
		enabled: step === "favorites",
		favorites,
		onToggleFavorite: toggleFavorite,
	});

	const persistHandleProfile = useCallback(async () => {
		const res = await api.api.profiles.me.patch({
			handle,
			displayName: displayName.trim(),
		});
		if (res.error) {
			const message =
				typeof res.error.value === "string"
					? res.error.value
					: "Could not save your handle";
			throw new Error(message);
		}
	}, [displayName, handle]);

	const finishAbbreviated = useCallback(async () => {
		setIsSkipping(true);
		try {
			const res = await api.api.profiles.me.patch({
				handle,
				displayName: displayName.trim(),
				markOnboarded: true,
			});
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Couldn't save your profile — try again";
				toast.error(message);
				return;
			}
			void authClient.getSession();
			router.replace("/home");
			router.refresh();
		} catch (err) {
			console.error("[onboarding] abbreviated finish failed", err);
			toast.error("Couldn't save your profile — try again");
		} finally {
			setIsSkipping(false);
		}
	}, [displayName, handle, router]);

	const finishFull = useCallback(async () => {
		setIsSaving(true);
		try {
			const result = await runOnboardingFinish(
				{
					avatarFile,
					tasteRatings,
					handle,
					displayName: displayName.trim(),
					bio,
					favoriteMovieIds: favorites.map((m) => m.id),
				},
				{
					uploadAvatar: async (file) => {
						await uploadProfileMeAsset("/api/profiles/me/avatar", file);
					},
					postLog: async (movieId, rating) => {
						const res = await api.api.logs.post({
							movieId,
							rating,
							watchedAt: new Date().toISOString(),
							visibility: "private",
							watchVenue: "streaming",
						});
						if (res.error) {
							if (isEmailVerificationRequiredError(res.error.value)) {
								throw new Error(EMAIL_VERIFICATION_REQUIRED_CODE);
							}
							throw new Error("Couldn't save ratings");
						}
					},
					patchProfile: async (body) => {
						const res = await api.api.profiles.me.patch(body);
						if (res.error) throw new Error("Couldn't save profile");
					},
					recomputeTaste: async () => {
						const res =
							await api.api.profiles.me["recompute-taste-signature"].post();
						return (res.data ?? {}) as { headline?: string };
					},
				},
			);
			setTasteHeadline(result.headline);
			void authClient.getSession();
			goTo("done", 1);
			toast.success("Profile saved");
		} catch (err) {
			console.error("[onboarding] finish failed", err);
			if (
				err instanceof Error &&
				err.message === EMAIL_VERIFICATION_REQUIRED_CODE
			) {
				toast.error(EMAIL_VERIFICATION_TOAST);
				goTo("verify", -1);
				return;
			}
			toast.error("Couldn't save your profile — try again");
		} finally {
			setIsSaving(false);
		}
	}, [avatarFile, bio, displayName, favorites, goTo, handle, tasteRatings]);

	const enterApp = useCallback(async () => {
		setIsEnteringApp(true);
		try {
			void authClient.getSession();
			router.replace("/home");
			router.refresh();
		} finally {
			setIsEnteringApp(false);
		}
	}, [router]);

	const editProfileFromDone = useCallback(() => {
		goTo(skipMode === "abbreviated" ? "name" : "avatar", -1);
	}, [goTo, skipMode]);

	const handleContinue = useCallback(async () => {
		if (step === "avatar") {
			goTo("name", 1);
			return;
		}
		if (step === "name") {
			goTo("handle", 1);
			return;
		}
		if (step === "handle") {
			if (!isHandleStepReady(handle, handleAvailability)) return;
			if (skipMode === "abbreviated") {
				await finishAbbreviated();
				return;
			}
			setIsSaving(true);
			try {
				await persistHandleProfile();
				goTo("bio", 1);
			} catch (err) {
				console.error("[onboarding] handle save failed", err);
				toast.error("Couldn't save your handle — try again");
			} finally {
				setIsSaving(false);
			}
			return;
		}
		if (step === "bio") {
			if (bio.trim()) {
				void api.api.profiles.me.patch({ bio: bio.trim() }).catch(() => {});
			}
			goTo(stepAfterBio(emailVerified), 1);
			return;
		}
		if (step === "taste") {
			goTo("favorites", 1);
			return;
		}
		if (step === "favorites") {
			await finishFull();
		}
	}, [
		bio,
		emailVerified,
		finishFull,
		goTo,
		handle,
		handleAvailability,
		finishAbbreviated,
		persistHandleProfile,
		skipMode,
		step,
	]);

	const handleBack = useCallback(() => {
		const prev = previousStep(step, skipMode);
		if (prev) goTo(prev, -1);
	}, [goTo, skipMode, step]);

	const continueDisabled = useMemo(() => {
		if (isSaving || isSkipping) return true;
		switch (step) {
			case "name":
				return !displayName.trim();
			case "handle":
				return !isHandleStepReady(handle, handleAvailability);
			case "taste":
				return !canAdvanceOnboardingTaste(tasteRatings, tasteSkipped);
			case "favorites":
				return favorites.length < ONBOARDING_FAVORITES_MIN;
			default:
				return false;
		}
	}, [
		displayName,
		favorites.length,
		handle,
		handleAvailability,
		isSaving,
		isSkipping,
		step,
		tasteRatings,
		tasteSkipped,
	]);

	const continueLabel = useMemo(() => {
		switch (step) {
			case "avatar":
				return avatarFile ? "Confirm my portrait" : "Continue";
			case "name":
				return "Confirm my name";
			case "handle":
				return skipMode === "abbreviated"
					? "Finish setup"
					: "Confirm my handle";
			case "bio":
				return "Continue";
			case "taste":
				return "Continue";
			case "favorites":
				return isSaving ? "Saving…" : "Complete setup";
			default:
				return "Continue";
		}
	}, [avatarFile, isSaving, skipMode, step]);

	const showNav = step !== "welcome" && step !== "verify" && step !== "done";
	const showBack =
		showNav && previousStep(step, skipMode) != null && step !== "avatar";

	const stepContent = useMemo(() => {
		switch (step) {
			case "welcome":
				return (
					<WelcomeStep
						isSkipping={isSkipping}
						onMaybeLater={() => {
							setSkipMode("abbreviated");
							goTo("name", 1);
						}}
						onProceed={() => {
							setSkipMode("full");
							goTo("avatar", 1);
						}}
					/>
				);
			case "avatar":
				return (
					<AvatarStep
						avatarPreviewUrl={avatarPreviewUrl}
						isPro={isPro}
						onAvatarFile={onAvatarFile}
					/>
				);
			case "name":
				return (
					<NameStep
						displayName={displayName}
						onBlur={(value) => setIsTypingName(value.trim().length > 0)}
						onDisplayNameChange={(value) => {
							setDisplayName(value);
							setIsTypingName(value.length > 0);
						}}
						onFocus={() => setIsTypingName(true)}
					/>
				);
			case "handle":
				return (
					<HandleStep
						availability={handleAvailability}
						handle={handle}
						onBlur={(value) => setIsTypingHandle(value.trim().length > 0)}
						onFocus={() => setIsTypingHandle(true)}
						onHandleChange={(value) => {
							setHandle(value);
							setIsTypingHandle(value.length > 0);
						}}
					/>
				);
			case "bio":
				return (
					<BioStep
						bio={bio}
						onBioChange={(value) => {
							setBio(value);
							setIsTypingBio(value.length > 0);
						}}
					/>
				);
			case "verify":
				return <VerifyEmailStep userEmail={userEmail} />;
			case "taste":
				return (
					<>
						<TasteStepControls model={tasteStepModel} />
						<div className="mt-6 w-full lg:hidden">
							<TasteStepGridPanel model={tasteStepModel} />
						</div>
					</>
				);
			case "favorites":
				return (
					<>
						<FavoritesStepControls model={favoritesStepModel} />
						<div className="mt-6 w-full lg:hidden">
							<FavoritesStepGridPanel model={favoritesStepModel} />
						</div>
					</>
				);
			case "done":
				return (
					<DoneStep
						isEntering={isEnteringApp}
						onEditProfile={editProfileFromDone}
						onEnterApp={() => void enterApp()}
						tasteHeadline={tasteHeadline}
					/>
				);
			default: {
				const unreachable: never = step;
				return unreachable;
			}
		}
	}, [
		avatarPreviewUrl,
		bio,
		displayName,
		editProfileFromDone,
		enterApp,
		favoritesStepModel,
		goTo,
		handle,
		handleAvailability,
		isEnteringApp,
		isPro,
		isSkipping,
		onAvatarFile,
		tasteHeadline,
		tasteStepModel,
		step,
		userEmail,
	]);

	const navFooter = showNav ? (
		<div className="flex items-center justify-between gap-4">
			{showBack ? (
				<OnboardingSecondaryButton className="gap-1 px-4" onClick={handleBack}>
					<ArrowLeft aria-hidden className="size-4" />
					Back
				</OnboardingSecondaryButton>
			) : (
				<span />
			)}
			<OnboardingPrimaryButton
				className={step === "avatar" && !showBack ? "w-full" : "ml-auto"}
				disabled={continueDisabled}
				onClick={() => void handleContinue()}
			>
				{continueLabel}
			</OnboardingPrimaryButton>
		</div>
	) : null;

	return (
		<OnboardingWizardLayout
			header={<BrandMark size="md" />}
			preview={
				step === "taste" ? (
					<TasteStepGridPanel
						className="size-full px-2 py-4"
						model={tasteStepModel}
					/>
				) : step === "favorites" ? (
					<FavoritesStepGridPanel
						className="size-full px-2 py-4"
						model={favoritesStepModel}
					/>
				) : (
					<OnboardingPreviewPanel
						avatarPreviewUrl={avatarPreviewUrl}
						bio={bio}
						displayName={displayName}
						favorites={favorites}
						handle={handle}
						isTypingBio={isTypingBio}
						isTypingHandle={isTypingHandle}
						isTypingName={isTypingName}
						step={step}
						tasteHeadline={tasteHeadline}
					/>
				)
			}
			previewClassName={
				step === "taste" || step === "favorites"
					? "items-stretch justify-stretch"
					: undefined
			}
			previewStrip={
				<OnboardingPreviewStrip
					avatarPreviewUrl={avatarPreviewUrl}
					displayName={displayName}
					handle={handle}
					step={step}
				/>
			}
			wizard={
				<OnboardingStepShell
					direction={direction}
					footer={navFooter}
					stepKey={step}
				>
					{stepContent}
				</OnboardingStepShell>
			}
		/>
	);
}
