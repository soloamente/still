"use client";

import { create } from "zustand";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PersonFilmographyPanel } from "@/components/movie/person-filmography-panel";
import type { PersonFilmographySeed } from "@/lib/person-filmography";

type Store = {
	isOpen: boolean;
	seed: PersonFilmographySeed | null;
	open: (seed: PersonFilmographySeed) => void;
	close: () => void;
};

export const usePersonFilmography = create<Store>((set) => ({
	isOpen: false,
	seed: null,
	open: (seed) => set({ isOpen: true, seed }),
	close: () => set({ isOpen: false, seed: null }),
}));

/** Global filmography sheet — arc cards and other detail surfaces open here. */
export function PersonFilmographyDrawerRoot() {
	const { isOpen, seed, close } = usePersonFilmography();

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			title={seed ? `${seed.name} — filmography` : "Filmography"}
			description={
				seed ? `Films and TV shows featuring ${seed.name}.` : undefined
			}
		>
			{seed ? <PersonFilmographyPanel seed={seed} active={isOpen} /> : null}
		</DetailVaulSheet>
	);
}

/** Open the global filmography sheet from cast/crew arc portraits. */
export function openPersonFilmography(seed: PersonFilmographySeed) {
	usePersonFilmography.getState().open(seed);
}
