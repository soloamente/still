"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import { OnboardingImportSourceList } from "@/components/onboarding/onboarding-import-source-list";
import {
	OnboardingPreviewPanel,
	OnboardingPreviewStrip,
} from "@/components/onboarding/onboarding-preview-panel";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
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
import { ImportStep } from "@/components/onboarding/onboarding-steps/import-step";
import { ImportUploadStep } from "@/components/onboarding/onboarding-steps/import-upload-step";
import { NameStep } from "@/components/onboarding/onboarding-steps/name-step";
import {
	TasteStepControls,
	TasteStepGridPanel,
	useTasteStepData,
} from "@/components/onboarding/onboarding-steps/taste-step";
import { VerifyEmailStep } from "@/components/onboarding/onboarding-steps/verify-email-step";
import { WelcomeStep } from "@/components/onboarding/onboarding-steps/welcome-step";
import { OnboardingWizardLayout } from "@/components/onboarding/onboarding-wizard-layout";
import { AnilistImportPanel } from "@/components/profile/anilist-import-panel";
import type { ImportPanelRunner } from "@/components/profile/import-panel-runner";
import { LetterboxdImportPanel } from "@/components/profile/letterboxd-import-panel";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
	EMAIL_VERIFICATION_REQUIRED_CODE,
	EMAIL_VERIFICATION_TOAST,
	isEmailVerificationRequiredError,
} from "@/lib/email-verification-error";
import { runOnboardingFinish } from "@/lib/onboarding-finish";
import { resolveOnboardingResumeStep } from "@/lib/onboarding-gate";
import {
	buildOnboardingImportQueue,
	type OnboardingImportLiveSource,
	toggleOnboardingImportLiveSource,
} from "@/lib/onboarding-import-queue";
import {
	isOnboardingImportStep,
	onboardingProgressFraction,
	previousOnboardingStep,
} from "@/lib/onboarding-step-graph";
import {
	canAdvanceOnboardingTaste,
	countOnboardingTasteRated,
} from "@/lib/onboarding-taste-state";
import {
	ONBOARDING_TASTE_MIN_RATED,
	type OnboardingMovie,
	type WizardSkipMode,
	type WizardStep,
} from "@/lib/onboarding-types";
import { uploadProfileMeAsset } from "@/lib/upload-profile-me-asset";

/** Tailwind `lg` — desktop preview column vs mobile inline upload panel. */
const ONBOARDING_LG_MQ = "(min-width: 1024px)";

function subscribeOnboardingLg(onStoreChange: () => void) {
	const mq = window.matchMedia(ONBOARDING_LG_MQ);
	mq.addEventListener("change", onStoreChange);
	return () => mq.removeEventListener("change", onStoreChange);
}

function getOnboardingLgSnapshot() {
	return window.matchMedia(ONBOARDING_LG_MQ).matches;
}

/** SSR / first paint uses the mobile slot so the upload panel is never dual-mounted. */
function getOnboardingLgServerSnapshot() {
	return false;
}

/**
 * Single Letterboxd or Anilist dropzone — parent mounts this in exactly one
 * slot (preview on lg, under the step below lg) so file state stays unique.
 */
function OnboardingImportUploadPanel({
	source,
	onImported,
	onRunnerChange,
}: {
	source: OnboardingImportLiveSource;
	onImported: () => void;
	onRunnerChange: (runner: ImportPanelRunner) => void;
}) {
	switch (source) {
		case "letterboxd":
			return (
				<LetterboxdImportPanel
					onImported={onImported}
					onRunnerChange={onRunnerChange}
					variant="onboarding"
				/>
			);
		case "anilist":
			return (
				<AnilistImportPanel
					onImported={onImported}
					onRunnerChange={onRunnerChange}
					variant="onboarding"
				/>
			);
		default: {
			const unreachable: never = source;
			return unreachable;
		}
	}
}

type OnboardingWizardProps = {
	initialDisplayName: string;
	initialHandle: string;
	initialBio: string;
	emailVerified: boolean;
	userEmail: string;
	isPro: boolean;
};

function stepAfterBio(verified: boolean): WizardStep {
	// Auth skips sendOnSignUp in development — don't trap patrons on verify locally.
	if (process.env.NODE_ENV === "development") return "taste";
	return verified ? "taste" : "verify";
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
	const [selectedImportSources, setSelectedImportSources] = useState<
		Set<OnboardingImportLiveSource>
	>(() => new Set());
	const [importQueue, setImportQueue] = useState<OnboardingImportLiveSource[]>(
		[],
	);
	const [importQueueIndex, setImportQueueIndex] = useState(0);
	const [importRunner, setImportRunner] = useState<ImportPanelRunner | null>(
		null,
	);

	const isLgViewport = useSyncExternalStore(
		subscribeOnboardingLg,
		getOnboardingLgSnapshot,
		getOnboardingLgServerSnapshot,
	);

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
					postLog: async (movieId, rating, options) => {
						const res = await api.api.logs.post({
							movieId,
							...(rating != null ? { rating } : {}),
							liked: options?.liked ?? false,
							watchedAt: new Date().toISOString(),
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
			goTo("import", 1);
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
			// Unlock `(app)` only when the patron chooses Enter — not after favorites
			// (import picker / upload still count as unfinished onboarding).
			const res = await api.api.profiles.me.patch({
				markOnboarded: true,
				// Re-send favorites so server showcase / diary backfill can run on mark.
				favoriteMovieIds: favorites.map((movie) => movie.id),
			});
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Couldn't finish setup — try again";
				toast.error(message);
				return;
			}
			void authClient.getSession();
			router.replace("/home");
			router.refresh();
		} catch (err) {
			console.error("[onboarding] enter app failed", err);
			toast.error("Couldn't finish setup — try again");
		} finally {
			setIsEnteringApp(false);
		}
	}, [favorites, router]);

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
		if (step === "import-upload") setImportRunner(null);
		const prev = previousOnboardingStep(step, skipMode);
		if (prev) goTo(prev, -1);
	}, [goTo, skipMode, step]);

	const toggleImportSource = useCallback((id: OnboardingImportLiveSource) => {
		setSelectedImportSources((current) =>
			toggleOnboardingImportLiveSource(current, id),
		);
	}, []);

	/** Only queue advance — Import click must not also call this after runImport. */
	const advanceImportQueue = useCallback(() => {
		const nextIndex = importQueueIndex + 1;
		if (nextIndex < importQueue.length) {
			setImportQueueIndex(nextIndex);
			setImportRunner(null);
			return;
		}
		goTo("done", 1);
	}, [goTo, importQueue.length, importQueueIndex]);

	const handleImportPickerContinue = useCallback(() => {
		const queue = buildOnboardingImportQueue(selectedImportSources);
		if (queue.length === 0) return;
		setImportQueue(queue);
		setImportQueueIndex(0);
		setImportRunner(null);
		goTo("import-upload", 1);
	}, [goTo, selectedImportSources]);

	const skipImport = useCallback(() => {
		goTo("done", 1);
	}, [goTo]);

	const handleImportClick = useCallback(() => {
		void importRunner?.runImport();
	}, [importRunner]);

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
				return false;
			default:
				return false;
		}
	}, [
		displayName,
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
			case "taste": {
				// Progress lives on the CTA so a disabled Continue explains the gate.
				const rated = countOnboardingTasteRated(tasteRatings, tasteSkipped);
				if (rated < ONBOARDING_TASTE_MIN_RATED) {
					return `${rated} / ${ONBOARDING_TASTE_MIN_RATED} rated`;
				}
				return "Continue";
			}
			case "favorites":
				return isSaving ? "Saving…" : "Complete setup";
			default:
				return "Continue";
		}
	}, [avatarFile, isSaving, skipMode, step, tasteRatings, tasteSkipped]);

	const importUploadSource = importQueue[importQueueIndex] ?? null;
	const importDisabled =
		!importRunner?.canImport || Boolean(importRunner?.isImporting);

	/** One panel instance — lg preview or mobile under the step, never both. */
	const importUploadPanel =
		importUploadSource != null ? (
			<OnboardingImportUploadPanel
				key={importUploadSource}
				onImported={advanceImportQueue}
				onRunnerChange={setImportRunner}
				source={importUploadSource}
			/>
		) : null;

	const showNav =
		step !== "welcome" &&
		step !== "verify" &&
		step !== "done" &&
		!isOnboardingImportStep(step);
	const showBack =
		showNav &&
		previousOnboardingStep(step, skipMode) != null &&
		step !== "avatar";

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
				return (
					<VerifyEmailStep
						userEmail={userEmail}
						onVerified={() => goTo("taste", 1)}
					/>
				);
			case "taste":
				return (
					<>
						<TasteStepControls model={tasteStepModel} />
						<div className="mt-6 w-full lg:hidden">
							<TasteStepGridPanel mobileInline model={tasteStepModel} />
						</div>
					</>
				);
			case "favorites":
				return (
					<>
						<FavoritesStepControls model={favoritesStepModel} />
						<div className="mt-6 w-full lg:hidden">
							<FavoritesStepGridPanel mobileInline model={favoritesStepModel} />
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
			case "import":
				return (
					<>
						<ImportStep
							continueDisabled={selectedImportSources.size === 0 || isSaving}
							onBack={handleBack}
							onContinue={handleImportPickerContinue}
							onNotNow={skipImport}
						/>
						<div className="mt-6 w-full lg:hidden">
							<OnboardingImportSourceList
								onToggleLive={toggleImportSource}
								selected={selectedImportSources}
							/>
						</div>
					</>
				);
			case "import-upload": {
				if (!importUploadSource) return null;
				return (
					<>
						<ImportUploadStep
							importDisabled={importDisabled}
							isImporting={Boolean(importRunner?.isImporting)}
							onBack={handleBack}
							onImport={handleImportClick}
							onSkip={skipImport}
							source={importUploadSource}
						/>
						{!isLgViewport ? (
							<div className="mt-6 w-full">{importUploadPanel}</div>
						) : null}
					</>
				);
			}
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
		handleBack,
		handleImportClick,
		handleImportPickerContinue,
		importDisabled,
		importRunner?.isImporting,
		importUploadPanel,
		importUploadSource,
		isEnteringApp,
		isLgViewport,
		isPro,
		isSaving,
		isSkipping,
		onAvatarFile,
		selectedImportSources,
		skipImport,
		tasteHeadline,
		tasteStepModel,
		toggleImportSource,
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

	// Logo stays on the wizard — linking / or /home would bounce mid-import.
	return (
		<OnboardingWizardLayout
			header={
				<BrandMark
					href="/onboarding"
					size="md"
					aria-label="Sense — stay on setup"
				/>
			}
			progress={
				<OnboardingProgress
					value={onboardingProgressFraction(step, skipMode)}
				/>
			}
			preview={
				step === "taste" ? (
					<TasteStepGridPanel
						className="size-full px-2"
						model={tasteStepModel}
					/>
				) : step === "favorites" ? (
					<FavoritesStepGridPanel
						className="size-full px-2"
						model={favoritesStepModel}
					/>
				) : step === "import" ? (
					<OnboardingImportSourceList
						fill
						onToggleLive={toggleImportSource}
						selected={selectedImportSources}
					/>
				) : step === "import-upload" && isLgViewport ? (
					/*
					  Absolute fill + min-h-full center — upload specimen mid-pane
					  (same shell pattern as the provider picker).
					*/
					<div className="absolute inset-0 overflow-y-auto overscroll-contain">
						<div className="flex min-h-full w-full items-center justify-center px-8 py-10 sm:px-12">
							<div className="mx-auto w-full max-w-lg">{importUploadPanel}</div>
						</div>
					</div>
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
				// Catalogue grids + import panes fill so absolute specimens can center.
				step === "taste" ||
				step === "favorites" ||
				step === "import" ||
				step === "import-upload"
					? "items-stretch justify-stretch"
					: undefined
			}
			previewKey={
				step === "import" || step === "import-upload"
					? "import"
					: step === "taste" || step === "favorites"
						? "catalogue"
						: "profile"
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
