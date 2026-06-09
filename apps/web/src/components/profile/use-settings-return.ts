"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
	type MovieDetailReturn,
	resolveSettingsReturn,
} from "@/lib/movie-detail-return";

/** Hydrates settings back link from the route before `/me/settings/*`. */
export function useSettingsReturn(): MovieDetailReturn {
	const pathname = usePathname();

	const [back, setBack] = useState<MovieDetailReturn>(() =>
		resolveSettingsReturn(pathname),
	);

	useEffect(() => {
		setBack(resolveSettingsReturn(pathname));
	}, [pathname]);

	return back;
}
