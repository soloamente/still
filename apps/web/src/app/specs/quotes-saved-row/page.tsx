"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { QuotesSavedRowSpecSheet } from "@/specs/quotes-saved-row-spec-sheet";

export default function QuotesSavedRowSpecPage() {
	const { resolvedTheme } = useTheme();
	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		if (resolvedTheme === "dark" || resolvedTheme === "light") {
			setTheme(resolvedTheme);
		}
	}, [resolvedTheme]);

	if (!resolvedTheme) {
		return null;
	}

	return <QuotesSavedRowSpecSheet theme={theme} />;
}
