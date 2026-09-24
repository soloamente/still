export function todaySlidePage(browse: "movies" | "tv"): "1" | "2" {
	return browse === "tv" ? "2" : "1";
}

export function todaySlideExitEnabled(hasShownOnce: boolean): "0" | "1" {
	return hasShownOnce ? "1" : "0";
}
