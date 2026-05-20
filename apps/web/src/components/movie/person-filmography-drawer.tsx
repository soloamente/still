"use client";

import { cn } from "@still/ui/lib/utils";
import { Drawer } from "vaul";
import { create } from "zustand";

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

/** Global Vaul host — arc cards and other detail surfaces open filmography here. */
export function PersonFilmographyDrawerRoot() {
	const { isOpen, seed, close } = usePersonFilmography();

	return (
		<Drawer.Root
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			shouldScaleBackground={false}
		>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-50 bg-absolute-black/82 backdrop-blur-sm" />
				<Drawer.Content
					className={cn(
						"fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[min(96svh,920px)] flex-col rounded-t-[2rem] bg-card outline-none",
						"shadow-2xl",
					)}
				>
					<Drawer.Handle className="mx-auto mt-3 mb-2 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/35" />
					{seed ? (
						<>
							<Drawer.Title className="sr-only">
								{seed.name} — filmography
							</Drawer.Title>
							<Drawer.Description className="sr-only">
								Films and TV shows featuring {seed.name}.
							</Drawer.Description>
							<PersonFilmographyPanel seed={seed} active={isOpen} />
						</>
					) : null}
					<Drawer.Close className="sr-only">Close filmography</Drawer.Close>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}

/** Open the global filmography drawer from cast/crew arc portraits. */
export function openPersonFilmography(seed: PersonFilmographySeed) {
	usePersonFilmography.getState().open(seed);
}
