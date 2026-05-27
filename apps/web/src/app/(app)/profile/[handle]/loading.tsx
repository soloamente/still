import { Skeleton } from "@still/ui/components/skeleton";
import { cn } from "@still/ui/lib/utils";

import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

export default function ProfileLoading() {
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<div className="sticky top-0 z-30 w-full bg-background px-2.5 py-2 sm:px-3">
				<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
					<Skeleton className="h-10 w-28 rounded-full" />
					<Skeleton className="mx-auto h-4 w-24" />
					<Skeleton className="ml-auto h-10 w-24 rounded-full" />
				</div>
			</div>
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"min-h-0 flex-1 gap-4 overflow-visible p-6 sm:gap-5 sm:p-8",
				)}
			>
				<Skeleton className="aspect-[3/1] w-full rounded-2xl" />
				<div className="mx-auto -mt-12 max-w-md text-center sm:-mt-14">
					<Skeleton className="mx-auto mb-4 aspect-[2/3] w-24 rounded-2xl" />
					<Skeleton className="mx-auto h-7 w-48" />
					<Skeleton className="mx-auto mt-2 h-3 w-28" />
					<Skeleton className="mx-auto mt-4 h-4 w-full max-w-sm" />
					<div className="mt-6 flex justify-center gap-2">
						<Skeleton className="h-10 w-28 rounded-full" />
						<Skeleton className="h-10 w-28 rounded-full" />
					</div>
				</div>
				<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
					<Skeleton className="h-10 w-52 max-w-full justify-self-start rounded-full" />
					<Skeleton className="h-10 w-48 justify-self-center rounded-full" />
					<Skeleton className="h-10 w-44 max-w-full justify-self-end rounded-full" />
				</div>
				<div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{(
						[
							"sk-a",
							"sk-b",
							"sk-c",
							"sk-d",
							"sk-e",
							"sk-f",
							"sk-g",
							"sk-h",
							"sk-i",
							"sk-j",
							"sk-k",
							"sk-l",
						] as const
					).map((id) => (
						<Skeleton key={id} className="aspect-[2/3] w-full rounded-[3rem]" />
					))}
				</div>
			</section>
		</div>
	);
}
