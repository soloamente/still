import type { SVGProps } from "react";

import { cn } from "../lib/utils";

import { BulletListGlyph18 } from "./nucleo-ui/BulletListGlyph18";
import { CameraGlyph18 } from "./nucleo-ui/CameraGlyph18";
import { CircleQuestionGlyph18 } from "./nucleo-ui/CircleQuestionGlyph18";
import { ClapperboardGlyph18 } from "./nucleo-ui/ClapperboardGlyph18";
import { CompassGlyph18 } from "./nucleo-ui/CompassGlyph18";
import { FaceSmileGlyph18 } from "./nucleo-ui/FaceSmileGlyph18";
import { GhostGlyph18 } from "./nucleo-ui/GhostGlyph18";
import { GreekTempleGlyph18 } from "./nucleo-ui/GreekTempleGlyph18";
import { HeartGlyph18 } from "./nucleo-ui/HeartGlyph18";
import { MagicHatGlyph18 } from "./nucleo-ui/MagicHatGlyph18";
import { MagnifierGlyph18 } from "./nucleo-ui/MagnifierGlyph18";
import { MusicGlyph18 } from "./nucleo-ui/MusicGlyph18";
import { RocketGlyph18 } from "./nucleo-ui/RocketGlyph18";
import { ShieldGlyph18 } from "./nucleo-ui/ShieldGlyph18";
import { SkullGlyph18 } from "./nucleo-ui/SkullGlyph18";
import { SparkleGlyph18 } from "./nucleo-ui/SparkleGlyph18";
import { SwordGlyph18 } from "./nucleo-ui/SwordGlyph18";
import { TagGlyph18 } from "./nucleo-ui/TagGlyph18";
import { TvGlyph18 } from "./nucleo-ui/TvGlyph18";
import { UsersGlyph18 } from "./nucleo-ui/UsersGlyph18";
import { XmarkGlyph18 } from "./nucleo-ui/XmarkGlyph18";

/** Nucleo UI glyph @ 18px — scaled via width/height for search pills. */
export type SearchDialogNucleoGlyphProps = SVGProps<SVGSVGElement> & {
	size?: number | string;
};

function glyphProps({
	size = 18,
	className,
	...rest
}: SearchDialogNucleoGlyphProps): SVGProps<SVGSVGElement> {
	return {
		width: size,
		height: size,
		className: cn("block shrink-0", className),
		"aria-hidden": rest["aria-hidden"] ?? true,
		...rest,
	};
}

export function IconSearchDialogMagnifier(props: SearchDialogNucleoGlyphProps) {
	return <MagnifierGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogXmark(props: SearchDialogNucleoGlyphProps) {
	return <XmarkGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogLists(props: SearchDialogNucleoGlyphProps) {
	return <BulletListGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogCinema(props: SearchDialogNucleoGlyphProps) {
	return <ClapperboardGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogTv(props: SearchDialogNucleoGlyphProps) {
	return <TvGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogPeople(props: SearchDialogNucleoGlyphProps) {
	return <UsersGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogCurated(props: SearchDialogNucleoGlyphProps) {
	return <SparkleGlyph18 {...glyphProps(props)} />;
}

export function IconSearchDialogTag(props: SearchDialogNucleoGlyphProps) {
	return <TagGlyph18 {...glyphProps(props)} />;
}

export type SearchDialogGenreGlyphKey =
	| "fantasy"
	| "action"
	| "horror"
	| "romance"
	| "adventure"
	| "animation"
	| "anime"
	| "thriller"
	| "scifi"
	| "documentary"
	| "comedy"
	| "drama"
	| "crime"
	| "mystery"
	| "family"
	| "music"
	| "war"
	| "western"
	| "history"
	| "default";

const GENRE_GLYPH: Record<SearchDialogGenreGlyphKey, typeof MagnifierGlyph18> =
	{
		fantasy: MagicHatGlyph18,
		action: SwordGlyph18,
		horror: GhostGlyph18,
		romance: HeartGlyph18,
		adventure: CompassGlyph18,
		animation: ClapperboardGlyph18,
		anime: SparkleGlyph18,
		thriller: SkullGlyph18,
		scifi: RocketGlyph18,
		documentary: CameraGlyph18,
		comedy: FaceSmileGlyph18,
		drama: ClapperboardGlyph18,
		crime: ShieldGlyph18,
		mystery: CircleQuestionGlyph18,
		family: UsersGlyph18,
		music: MusicGlyph18,
		war: ShieldGlyph18,
		western: CompassGlyph18,
		history: GreekTempleGlyph18,
		default: TagGlyph18,
	};

export function IconSearchDialogGenre({
	glyph,
	...props
}: SearchDialogNucleoGlyphProps & { glyph: SearchDialogGenreGlyphKey }) {
	const Icon = GENRE_GLYPH[glyph];
	return <Icon {...glyphProps(props)} />;
}
