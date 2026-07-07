import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import { ListingDetailHeroSynopsis } from "@/components/detail/listing-detail-hero-synopsis";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PersonDetailInfoCards } from "@/components/people/person-detail-info-cards";
import type { PersonDetailInfoCard } from "@/lib/person-detail-facts";

/**
 * Centered person hero — portrait, department, name, fact cards, and biography
 * synopsis drawer (same rhythm as film/TV detail heroes).
 */
export function PersonDetailHero({
	name,
	knownForDepartment,
	profilePath,
	profileUrl,
	biography,
	infoCards,
}: {
	name: string;
	knownForDepartment?: string | null;
	profilePath: string | null;
	profileUrl: string | null;
	biography: string | null;
	infoCards: PersonDetailInfoCard[];
}) {
	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-lg flex-col items-center px-2.5 pt-12 pb-6 text-center sm:max-w-xl sm:px-3 sm:pt-14 sm:pb-8 md:pt-16 md:pb-10 lg:max-w-2xl lg:pt-20",
			)}
		>
			{knownForDepartment ? (
				<p className="mb-5 text-muted-foreground text-xs uppercase tracking-wide">
					{knownForDepartment}
				</p>
			) : null}

			<div className="mx-auto w-full max-w-[min(100%,22rem)]">
				<div
					className={cn(
						"relative aspect-2/3 overflow-hidden rounded-[1.25rem] bg-muted/20 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem]",
						"[outline:1px_solid_rgba(255,255,255,0.1)]",
					)}
				>
					{profileUrl ? (
						<Image
							src={profileUrl}
							alt={name}
							fill
							className="object-cover"
							sizes="(max-width: 768px) 100vw, 360px"
							priority
						/>
					) : (
						<div className="absolute inset-0">
							<PersonCreditPortrait
								name={name}
								profilePath={profilePath}
								sizes="(max-width: 768px) 100vw, 360px"
								imageClassName="size-full object-cover"
							/>
						</div>
					)}
				</div>
			</div>

			<h1 className="mt-7 text-balance font-sans font-semibold text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
				{name}
			</h1>

			<PersonDetailInfoCards cards={infoCards} />

			<ListingDetailHeroSynopsis title={name} overview={biography} />
		</div>
	);
}
