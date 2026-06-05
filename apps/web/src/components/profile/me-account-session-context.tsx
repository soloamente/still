"use client";

import { useRouter } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { MeAccountLeaveConfirmDialog } from "@/components/profile/me-account-leave-confirm-dialog";

/** Persisted settings draft — survives soft refresh while editing `/me/settings/*`. */
export const ME_ACCOUNT_SETTINGS_DRAFT_STORAGE_KEY =
	"still:me:settings-draft:v1";

export type MeAccountSettingsDraftPayload = {
	displayName: string;
	bio: string;
	pronouns: string;
	location: string;
	website: string;
	isPrivate: boolean;
	theaterAudio: boolean;
	smoothScroll: boolean;
	catalogMonochromePeersOnHover: boolean;
	catalogTmdbWatchRegion: string;
	catalogTmdbLanguage: string;
	showAdultContent?: boolean;
	birthDate?: string;
	showBirthDateOnProfile?: boolean;
	appTheme?: string;
};

export type MeAccountPendingImage = { file: File; previewUrl: string };

export function readStoredSettingsDraft(): MeAccountSettingsDraftPayload | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(ME_ACCOUNT_SETTINGS_DRAFT_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as MeAccountSettingsDraftPayload;
	} catch {
		return null;
	}
}

export function writeStoredSettingsDraft(
	payload: MeAccountSettingsDraftPayload,
) {
	try {
		sessionStorage.setItem(
			ME_ACCOUNT_SETTINGS_DRAFT_STORAGE_KEY,
			JSON.stringify(payload),
		);
	} catch {
		/* quota / private mode */
	}
}

export function clearStoredSettingsDraft() {
	try {
		sessionStorage.removeItem(ME_ACCOUNT_SETTINGS_DRAFT_STORAGE_KEY);
	} catch {
		/* noop */
	}
}

type MeAccountSessionContextValue = {
	/** Staged banner/avatar survive route changes under `/me/*`. */
	pendingBanner: MeAccountPendingImage | null;
	pendingAvatar: MeAccountPendingImage | null;
	setPendingBanner: (
		next:
			| MeAccountPendingImage
			| null
			| ((prev: MeAccountPendingImage | null) => MeAccountPendingImage | null),
	) => void;
	setPendingAvatar: (
		next:
			| MeAccountPendingImage
			| null
			| ((prev: MeAccountPendingImage | null) => MeAccountPendingImage | null),
	) => void;
	revokeAllCustomizationPending: () => void;
	/** Keep last dirty flags after forms unmount so nav guards still see `/me` edits. */
	syncSettingsDirty: (dirty: boolean) => void;
	syncCustomizationDirty: (dirty: boolean) => void;
	/** True while settings or customize still have unsaved work (drives `beforeunload`). */
	anyUnsaved: () => boolean;
	/**
	 * Clears cross-route settings text draft + staged media after the user confirms they want
	 * to discard — used when leaving `/me/*` for another route.
	 */
	discardAllUnsaved: () => void;
	/**
	 * Navigate to `href` when safe; if there are unsaved edits, opens the leave dialog instead
	 * (caller should `preventDefault` on a link click when this will run).
	 */
	requestLeaveTo: (href: string) => void;
};

const MeAccountSessionContext =
	createContext<MeAccountSessionContextValue | null>(null);

export function MeAccountSessionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const router = useRouter();
	const [leaveTargetHref, setLeaveTargetHref] = useState<string | null>(null);
	const settingsDirtyRef = useRef(false);
	const customizationDirtyRef = useRef(false);

	const [pendingBanner, setPendingBannerState] =
		useState<MeAccountPendingImage | null>(null);
	const [pendingAvatar, setPendingAvatarState] =
		useState<MeAccountPendingImage | null>(null);

	const setPendingBanner = useCallback(
		(
			next:
				| MeAccountPendingImage
				| null
				| ((
						prev: MeAccountPendingImage | null,
				  ) => MeAccountPendingImage | null),
		) => {
			setPendingBannerState((prev) => {
				const resolved = typeof next === "function" ? next(prev) : next;
				if (prev && prev !== resolved) {
					URL.revokeObjectURL(prev.previewUrl);
				}
				return resolved;
			});
		},
		[],
	);

	const setPendingAvatar = useCallback(
		(
			next:
				| MeAccountPendingImage
				| null
				| ((
						prev: MeAccountPendingImage | null,
				  ) => MeAccountPendingImage | null),
		) => {
			setPendingAvatarState((prev) => {
				const resolved = typeof next === "function" ? next(prev) : next;
				if (prev && prev !== resolved) {
					URL.revokeObjectURL(prev.previewUrl);
				}
				return resolved;
			});
		},
		[],
	);

	const revokeAllCustomizationPending = useCallback(() => {
		setPendingBannerState((prev) => {
			if (prev) URL.revokeObjectURL(prev.previewUrl);
			return null;
		});
		setPendingAvatarState((prev) => {
			if (prev) URL.revokeObjectURL(prev.previewUrl);
			return null;
		});
	}, []);

	const syncSettingsDirty = useCallback((dirty: boolean) => {
		settingsDirtyRef.current = dirty;
	}, []);

	const syncCustomizationDirty = useCallback((dirty: boolean) => {
		customizationDirtyRef.current = dirty;
	}, []);

	const anyUnsaved = useCallback(() => {
		return (
			settingsDirtyRef.current ||
			customizationDirtyRef.current ||
			Boolean(readStoredSettingsDraft())
		);
	}, []);

	const discardAllUnsaved = useCallback(() => {
		clearStoredSettingsDraft();
		revokeAllCustomizationPending();
		settingsDirtyRef.current = false;
		customizationDirtyRef.current = false;
	}, [revokeAllCustomizationPending]);

	const requestLeaveTo = useCallback(
		(href: string) => {
			if (!anyUnsaved()) {
				router.push(href);
				return;
			}
			setLeaveTargetHref(href);
		},
		[anyUnsaved, router],
	);

	const handleLeaveStay = useCallback(() => {
		setLeaveTargetHref(null);
	}, []);

	const handleLeaveDiscard = useCallback(() => {
		if (!leaveTargetHref) return;
		const target = leaveTargetHref;
		setLeaveTargetHref(null);
		discardAllUnsaved();
		router.push(target);
	}, [discardAllUnsaved, leaveTargetHref, router]);

	useEffect(() => {
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (!anyUnsaved()) return;
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [anyUnsaved]);

	const value = useMemo(
		() => ({
			pendingBanner,
			pendingAvatar,
			setPendingBanner,
			setPendingAvatar,
			revokeAllCustomizationPending,
			syncSettingsDirty,
			syncCustomizationDirty,
			anyUnsaved,
			discardAllUnsaved,
			requestLeaveTo,
		}),
		[
			pendingAvatar,
			pendingBanner,
			anyUnsaved,
			discardAllUnsaved,
			requestLeaveTo,
			revokeAllCustomizationPending,
			setPendingAvatar,
			setPendingBanner,
			syncCustomizationDirty,
			syncSettingsDirty,
		],
	);

	return (
		<MeAccountSessionContext.Provider value={value}>
			{children}
			<MeAccountLeaveConfirmDialog
				open={leaveTargetHref !== null}
				onStay={handleLeaveStay}
				onDiscard={handleLeaveDiscard}
			/>
		</MeAccountSessionContext.Provider>
	);
}

export function useMeAccountSession(): MeAccountSessionContextValue {
	const ctx = useContext(MeAccountSessionContext);
	if (!ctx) {
		throw new Error(
			"useMeAccountSession must be used under MeAccountSessionProvider",
		);
	}
	return ctx;
}

/** Optional consumer when the provider is not guaranteed (e.g. tests). */
export function useMeAccountSessionOptional(): MeAccountSessionContextValue | null {
	return useContext(MeAccountSessionContext);
}
