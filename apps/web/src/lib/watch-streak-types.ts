/** Client mirror of `GET /api/streaks/me` streak payload. */
export type WatchStreakSnapshot = {
	currentStreak: number;
	longestStreak: number;
	lastActiveDay: string | null;
	shieldsRemaining: number;
	autoGraceAvailable: boolean;
	freezeCoversDay: string | null;
	status: "active" | "at_risk" | "idle" | "broken";
	todayDay: string;
};
