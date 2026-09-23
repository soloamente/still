"use client";

import IconBell from "@still/ui/icons/bell";
import IconBellFilled from "@still/ui/icons/bell-filled";
import IconStarFilled from "@still/ui/icons/star-filled";
import IconStarOutline from "@still/ui/icons/star-outline";
import { cn } from "@still/ui/lib/utils";
import { motion } from "motion/react";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { BELL_RING_ORIGIN_CLASS, ringBellElement } from "@/lib/bell-ring-animation";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import {
	fetchPersonFavorite,
	setPersonFavorite,
	setPersonFavoriteAlerts,
} from "@/lib/still-api-fetch";

const LABEL_WIDTH_EASE = "cubic-bezier(0.24, 1.34, 0.38, 1)";

/**
 * Person hero Favorite + Notify row. Notify confirmation is the pressed control
 * itself (no toast) — bell rings only when turning alerts on.
 */
export function PersonDetailFavoriteActions({
	personId,
}: {
	personId: number;
}) {
	const { data: session, isPending } = authClient.useSession();
	const [hydrated, setHydrated] = useState(false);
	const [favorited, setFavorited] = useState(false);
	const [alertsEnabled, setAlertsEnabled] = useState(false);
	const [favoriteBusy, setFavoriteBusy] = useState(false);
	const [notifyBusy, setNotifyBusy] = useState(false);

	useEffect(() => {
		if (!session?.user) {
			setHydrated(true);
			setFavorited(false);
			setAlertsEnabled(false);
			return;
		}
		const controller = new AbortController();
		let cancelled = false;
		void (async () => {
			const result = await fetchPersonFavorite(personId, {
				signal: controller.signal,
			});
			if (cancelled || controller.signal.aborted) return;
			if (result.ok) {
				setFavorited(result.favorited);
				setAlertsEnabled(result.alertsEnabled);
			}
			setHydrated(true);
		})().catch((err: unknown) => {
			if (err instanceof DOMException && err.name === "AbortError") return;
			if (!cancelled) setHydrated(true);
		});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [personId, session?.user]);

	if (isPending || !session?.user) return null;

	return (
		<div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
			<FavoritePill
				favorited={favorited}
				busy={!hydrated || favoriteBusy}
				onToggle={async () => {
					const next = !favorited;
					setFavorited(next);
					if (!next) setAlertsEnabled(false);
					setFavoriteBusy(true);
					const result = await setPersonFavorite(personId, next);
					setFavoriteBusy(false);
					if (!result.ok) {
						setFavorited(!next);
						if (!next) setAlertsEnabled(alertsEnabled);
						toast.error(
							next
								? "Couldn’t favorite this person"
								: "Couldn’t remove favorite",
						);
						return;
					}
					setAlertsEnabled(result.alertsEnabled);
				}}
			/>
			<NotifyBellPill
				on={alertsEnabled}
				busy={!hydrated || notifyBusy}
				onToggle={async () => {
					const next = !alertsEnabled;
					const prevFavorited = favorited;
					setAlertsEnabled(next);
					if (next) setFavorited(true);
					setNotifyBusy(true);
					const result = await setPersonFavoriteAlerts(personId, next);
					setNotifyBusy(false);
					if (!result.ok) {
						setAlertsEnabled(!next);
						setFavorited(prevFavorited);
						toast.error(
							next
								? "Couldn’t enable alerts"
								: "Couldn’t turn off alerts",
						);
						return;
					}
					setFavorited(result.favorited);
					setAlertsEnabled(result.alertsEnabled);
				}}
			/>
		</div>
	);
}

function FavoritePill({
	favorited,
	busy,
	onToggle,
}: {
	favorited: boolean;
	busy: boolean;
	onToggle: () => void | Promise<void>;
}) {
	const motionProps = useDetailActionMotion();
	return (
		<motion.button
			type="button"
			className={cn(
				"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-sm sm:text-base",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"disabled:pointer-events-none disabled:opacity-45 select-none",
				favorited
					? "bg-foreground text-background"
					: cn(
							"bg-background text-foreground",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						),
				DETAIL_MOTION_PRESSABLE_CLASS,
			)}
			style={motionProps.style}
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
			onClick={() => void onToggle()}
			disabled={busy}
			aria-pressed={favorited}
			aria-busy={busy || undefined}
			aria-label={favorited ? "Favorited — remove" : "Favorite this person"}
		>
			{favorited ? (
				<IconStarFilled size="18px" className="shrink-0" />
			) : (
				<IconStarOutline size="18px" className="shrink-0 opacity-90" />
			)}
			{favorited ? "Favorited" : "Favorite"}
		</motion.button>
	);
}

/**
 * Notify control — confirmation is the pressed pill. Bell swings (damped) only
 * when turning on; label width grows into the longer copy without a snap.
 */
function NotifyBellPill({
	on,
	busy,
	onToggle,
}: {
	on: boolean;
	busy: boolean;
	onToggle: () => void | Promise<void>;
}) {
	const motionProps = useDetailActionMotion();
	const bellRef = useRef<HTMLSpanElement>(null);
	const offLabelRef = useRef<HTMLSpanElement>(null);
	const onLabelRef = useRef<HTMLSpanElement>(null);
	const [labelWidth, setLabelWidth] = useState<number | undefined>(undefined);
	const wasOnRef = useRef(on);

	useLayoutEffect(() => {
		const shown = on ? onLabelRef.current : offLabelRef.current;
		if (!shown) return;
		setLabelWidth(shown.offsetWidth);
	}, [on]);

	useEffect(() => {
		const turnedOn = on && !wasOnRef.current;
		wasOnRef.current = on;
		if (!turnedOn || !bellRef.current) return;
		// Hang from the crown — pivot at the top of the glyph.
		ringBellElement(bellRef.current);
	}, [on]);

	return (
		<motion.button
			type="button"
			data-on={on ? "true" : "false"}
			className={cn(
				"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-sm sm:text-base",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"disabled:pointer-events-none disabled:opacity-45 select-none",
				on
					? "bg-foreground text-background"
					: cn(
							"bg-background text-foreground",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						),
				DETAIL_MOTION_PRESSABLE_CLASS,
			)}
			style={motionProps.style}
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
			onClick={() => void onToggle()}
			disabled={busy}
			aria-pressed={on}
			aria-busy={busy || undefined}
			aria-label={
				on ? "You'll be notified — turn off alerts" : "Notify me about new work"
			}
		>
			<span
				ref={bellRef}
				className={cn("inline-flex shrink-0", BELL_RING_ORIGIN_CLASS)}
				aria-hidden
			>
				{on ? (
					<IconBellFilled size="18px" className="opacity-90" />
				) : (
					<IconBell size="18px" className="opacity-90" />
				)}
			</span>
			<span
				className="relative inline-block overflow-hidden whitespace-nowrap"
				style={{
					width: labelWidth,
					transition: `width 460ms ${LABEL_WIDTH_EASE}`,
				}}
			>
				{/* Stacked labels — out of flow so width can grow into the answer. */}
				<span
					ref={offLabelRef}
					data-show={on ? "false" : "true"}
					className={cn(
						"inline-block",
						on ? "pointer-events-none absolute opacity-0" : "relative",
					)}
					aria-hidden={on}
				>
					Notify me
				</span>
				<span
					ref={onLabelRef}
					data-show={on ? "true" : "false"}
					className={cn(
						"inline-block",
						on ? "relative" : "pointer-events-none absolute opacity-0",
					)}
					aria-hidden={!on}
				>
					You&apos;ll be notified
				</span>
			</span>
		</motion.button>
	);
}
