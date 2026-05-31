import type { WatchStreakSnapshot } from "@/lib/watch-streak-types";

export function watchStreakLabel(currentStreak: number) {
	if (currentStreak <= 0) return "Diary streak";
	if (currentStreak === 1) return "1-day streak";
	return `${currentStreak}-day streak`;
}

export function watchStreakStatusLine(
	streak: WatchStreakSnapshot,
	hasCount: boolean,
) {
	if (!hasCount) return "Log a film today to start";
	if (streak.status === "at_risk") return "Log today to keep it";
	if (streak.status === "broken") return "Log a film to restart";
	if (streak.freezeCoversDay === streak.todayDay) {
		return "Shield active today";
	}
	if (streak.status === "active") return "Active today";
	return null;
}
