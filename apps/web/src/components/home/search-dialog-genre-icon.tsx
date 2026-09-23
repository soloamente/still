"use client";

import { cn } from "@still/ui/lib/utils";
import {
	Camera,
	Clapperboard,
	Compass,
	Drama,
	Ghost,
	Heart,
	Landmark,
	Music,
	Rocket,
	Shield,
	Skull,
	Smile,
	Sparkles,
	Swords,
	Tag,
	Users,
	Wand2,
} from "lucide-react";
import type { SearchDialogGenreIconKey } from "@/lib/search-dialog-genre-icon";
import { searchDialogGenreIconKey } from "@/lib/search-dialog-genre-icon";

const ICON_BY_KEY: Record<SearchDialogGenreIconKey, typeof Sparkles> = {
	fantasy: Wand2,
	action: Swords,
	horror: Ghost,
	romance: Heart,
	adventure: Compass,
	animation: Clapperboard,
	anime: Sparkles,
	thriller: Skull,
	scifi: Rocket,
	documentary: Camera,
	comedy: Smile,
	drama: Drama,
	crime: Shield,
	mystery: Tag,
	family: Users,
	music: Music,
	war: Shield,
	western: Compass,
	history: Landmark,
	default: Tag,
};

/** Leading mark for genre chips — Lucide glyphs, filled to match Figma weight. */
export function SearchDialogGenreIcon({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const Icon = ICON_BY_KEY[searchDialogGenreIconKey(name)];
	return (
		<Icon
			className={cn("size-3.5 shrink-0 fill-current", className)}
			strokeWidth={1.5}
			aria-hidden
		/>
	);
}
