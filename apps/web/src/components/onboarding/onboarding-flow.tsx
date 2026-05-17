"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import { MoviePoster } from "@/components/movie/movie-poster";
import { api } from "@/lib/api";
import { fetchMoviesSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/**
 * Three-step onboarding modeled after Letterboxd's: bio, favorite films
 * (4 to start), then a "you're all set" success step. The form lives in
 * local state and writes the final shape to /api/profiles/me at the end.
 */
type Step = "bio" | "favorites" | "done";

type Movie = { id: number; title: string; poster_url: string | null };

export function OnboardingFlow({
	initialProfile,
}: {
	initialProfile: {
		handle: string;
		displayName: string;
		bio: string;
		favoriteMovieIds: number[];
	};
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	/** Track B.6: step panels cap at 200ms; OS reduced motion → instant cross-fade. */
	const stepTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };
	const [step, setStep] = useState<Step>("bio");
	const [bio, setBio] = useState(initialProfile.bio);
	const [favorites, setFavorites] = useState<Movie[]>([]);
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<Movie[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [tmdbHint, setTmdbHint] = useState<string | null>(null);

	useEffect(() => {
		const trimmed = search.trim();
		if (!trimmed) {
			setResults([]);
			setTmdbHint(null);
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchMoviesSearch(trimmed, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setTmdbHint(null);
					return;
				}
				const data = res.data as { results?: Movie[] } | null;
				setTmdbHint(tmdbSetupHint(data));
				setResults((data?.results ?? []).slice(0, 8));
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setTmdbHint(null);
				}
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [search]);

	const canAdvanceFromBio = useMemo(() => bio.trim().length <= 600, [bio]);
	const canFinish = favorites.length >= 1;

	function toggleFavorite(m: Movie) {
		setFavorites((current) => {
			if (current.some((c) => c.id === m.id))
				return current.filter((c) => c.id !== m.id);
			if (current.length >= 8) return current;
			return [...current, m];
		});
	}

	async function finish() {
		setIsSaving(true);
		try {
			await api.api.profiles.me.patch({
				bio: bio.trim() || undefined,
				favoriteMovieIds: favorites.map((m) => m.id),
				// We re-send handle/displayName to satisfy the server's first-write
				// requirement on profiles that don't yet exist.
				handle: initialProfile.handle,
				displayName: initialProfile.displayName,
				markOnboarded: true,
			});
			setStep("done");
			toast.success("Profile saved");
			setTimeout(() => {
				router.replace("/home");
				router.refresh();
			}, 900);
		} catch (err) {
			console.error("[onboarding] save failed", err);
			toast.error("Couldn't save your profile — try again");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<div className="space-y-10">
			<div className="flex items-center justify-between">
				<BrandMark size="md" />
				<StepDots step={step} />
			</div>
			<AnimatePresence mode="wait">
				{step === "bio" ? (
					<motion.section
						key="bio"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={stepTransition}
						className="space-y-6"
					>
						<h1 className="font-display font-medium text-3xl tracking-[-0.02em] md:text-4xl">
							Hi @{initialProfile.handle}.
						</h1>
						<p className="text-muted-foreground">
							Tell people who you are. You can change this anytime.
						</p>
						<div className="space-y-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea
								id="bio"
								placeholder="A few sentences about your taste, or just a quote."
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								maxLength={600}
							/>
							<p className="text-muted-foreground text-xs">
								{600 - bio.length} characters left
							</p>
						</div>
						<div className="flex justify-end">
							<Button
								variant="accent"
								size="pill"
								disabled={!canAdvanceFromBio}
								onClick={() => setStep("favorites")}
							>
								Continue
							</Button>
						</div>
					</motion.section>
				) : null}

				{step === "favorites" ? (
					<motion.section
						key="favorites"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={stepTransition}
						className="space-y-6"
					>
						<div>
							<h1 className="font-display font-medium text-3xl tracking-[-0.02em] md:text-4xl">
								Your four favorites
							</h1>
							<p className="mt-2 text-muted-foreground">
								Pick up to 8 films that define your taste. These pin to your
								profile.
							</p>
						</div>
						<Input
							type="search"
							placeholder="Search films…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							spellCheck={false}
						/>
						{tmdbHint ? (
							<p className="text-muted-foreground text-sm" role="status">
								{tmdbHint}
							</p>
						) : null}
						{favorites.length ? (
							<div className="grid grid-cols-4 gap-3 md:grid-cols-8">
								{favorites.map((m) => (
									<button
										key={m.id}
										type="button"
										onClick={() => toggleFavorite(m)}
										className="group relative aspect-[2/3] overflow-hidden rounded-md border border-desert-orange"
										aria-label={`Remove ${m.title}`}
									>
										{m.poster_url ? (
											<Image
												src={m.poster_url}
												alt={m.title}
												width={200}
												height={300}
												className="size-full object-cover"
												loading="lazy"
											/>
										) : (
											<div className="size-full bg-muted" />
										)}
										<span className="absolute inset-0 grid place-items-center bg-absolute-black/60 opacity-0 transition-opacity group-hover:opacity-100">
											<span className="rounded-md bg-desert-orange px-2 py-1 text-xs">
												Remove
											</span>
										</span>
									</button>
								))}
							</div>
						) : null}
						{results.length ? (
							<div>
								<p className="mb-2 text-muted-foreground text-xs uppercase tracking-wider">
									Search results
								</p>
								<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
									{results
										.filter((r) => !favorites.some((f) => f.id === r.id))
										.map((m) => (
											<button
												key={m.id}
												type="button"
												onClick={() => toggleFavorite(m)}
												className="group block text-left"
											>
												<MoviePoster
													movieId={m.id}
													title={m.title}
													posterUrl={m.poster_url}
													size="sm"
												/>
												<p className="mt-1 line-clamp-2 text-muted-foreground text-xs group-hover:text-foreground">
													{m.title}
												</p>
											</button>
										))}
								</div>
							</div>
						) : null}
						<div className="flex justify-between">
							<Button
								variant="ghost-light"
								size="pill"
								onClick={() => setStep("bio")}
							>
								Back
							</Button>
							<Button
								variant="accent"
								size="pill"
								onClick={finish}
								disabled={!canFinish || isSaving}
							>
								{isSaving ? "Saving…" : "Finish setup"}
							</Button>
						</div>
					</motion.section>
				) : null}

				{step === "done" ? (
					<motion.section
						key="done"
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={stepTransition}
						className="space-y-4 text-center"
					>
						<h1 className="font-display text-4xl tracking-[-0.02em]">
							All set.
						</h1>
						<p className="text-muted-foreground">Taking you home…</p>
					</motion.section>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function StepDots({ step }: { step: Step }) {
	const idx = step === "bio" ? 0 : step === "favorites" ? 1 : 2;
	return (
		<div className="flex items-center gap-1.5">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className={
						i === idx
							? "size-1.5 rounded-full bg-desert-orange"
							: i < idx
								? "size-1.5 rounded-full bg-foreground/70"
								: "size-1.5 rounded-full bg-muted"
					}
				/>
			))}
		</div>
	);
}
