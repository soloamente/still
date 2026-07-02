"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { FeedbackComposeDialog } from "@/components/feedback/feedback-compose-dialog";
import { FeedbackDrawer } from "@/components/feedback/feedback-drawer";
import { feedbackIdFromSearch } from "@/lib/feedback-notification-href";

type FeedbackDrawerMode = "list" | "thread";

type FeedbackDrawerContextValue = {
	openCompose: () => void;
	openFeedbackList: () => void;
	openFeedbackThread: (feedbackId: string) => void;
};

const FeedbackDrawerContext = createContext<FeedbackDrawerContextValue | null>(
	null,
);

/** Global patron feedback surfaces (compose dialog + history drawer). */
export function FeedbackDrawerProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [composeOpen, setComposeOpen] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerMode, setDrawerMode] = useState<FeedbackDrawerMode>("list");
	const [threadId, setThreadId] = useState<string | null>(null);
	const [listRefreshKey, setListRefreshKey] = useState(0);

	const openCompose = useCallback(() => {
		setComposeOpen(true);
	}, []);

	const openFeedbackList = useCallback(() => {
		setDrawerMode("list");
		setThreadId(null);
		setDrawerOpen(true);
	}, []);

	const openFeedbackThread = useCallback((feedbackId: string) => {
		setDrawerMode("thread");
		setThreadId(feedbackId);
		setDrawerOpen(true);
	}, []);

	const handleBackToList = useCallback(() => {
		setDrawerMode("list");
		setThreadId(null);
	}, []);

	// Notification / URL deep links: `/home?feedback=<id>` opens the thread drawer.
	useEffect(() => {
		const feedbackId = feedbackIdFromSearch(searchParams);
		if (!feedbackId) return;

		openFeedbackThread(feedbackId);

		const params = new URLSearchParams(searchParams.toString());
		params.delete("feedback");
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}, [searchParams, pathname, router, openFeedbackThread]);

	const value = useMemo(
		() => ({
			openCompose,
			openFeedbackList,
			openFeedbackThread,
		}),
		[openCompose, openFeedbackList, openFeedbackThread],
	);

	return (
		<FeedbackDrawerContext.Provider value={value}>
			{children}
			<FeedbackComposeDialog
				open={composeOpen}
				onOpenChange={setComposeOpen}
				onSubmitted={() => {
					setListRefreshKey((key) => key + 1);
				}}
			/>
			<FeedbackDrawer
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				mode={drawerMode}
				threadId={threadId}
				onOpenCompose={() => {
					setDrawerOpen(false);
					openCompose();
				}}
				onBackToList={handleBackToList}
				onSelectThread={openFeedbackThread}
				listRefreshKey={listRefreshKey}
			/>
		</FeedbackDrawerContext.Provider>
	);
}

export function useFeedbackDrawer(): FeedbackDrawerContextValue {
	const ctx = useContext(FeedbackDrawerContext);
	if (!ctx) {
		throw new Error(
			"useFeedbackDrawer must be used within FeedbackDrawerProvider",
		);
	}
	return ctx;
}
