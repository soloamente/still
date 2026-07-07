"use client";

import { cn } from "@still/ui/lib/utils";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { PersonDetailTopBar } from "@/components/people/person-detail-top-bar";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	type PersonDetailView,
	parsePersonDetailViewFromSearchParams,
} from "@/lib/person-detail-view";

/**
 * Client shell for TMDb person detail — instant About/Filmography tab switches
 * without freezing sticky chrome; hero and panels stream in from the RSC page.
 */
export function PersonDetailViewShell({
	initialView,
	basePath,
	personId,
	title,
	hero,
	about,
	filmography,
}: {
	initialView: PersonDetailView;
	basePath: string;
	personId: number;
	title: string;
	hero: ReactNode;
	about: ReactNode;
	filmography: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<PersonDetailViewShellBody
				initialView={initialView}
				basePath={basePath}
				personId={personId}
				title={title}
				hero={hero}
				about={about}
				filmography={filmography}
			/>
		</LobbyNavigationProvider>
	);
}

function PersonDetailViewShellBody({
	initialView,
	basePath,
	personId,
	title,
	hero,
	about,
	filmography,
}: {
	initialView: PersonDetailView;
	basePath: string;
	personId: number;
	title: string;
	hero: ReactNode;
	about: ReactNode;
	filmography: ReactNode;
}) {
	const searchParams = useSearchParams();
	const urlView = parsePersonDetailViewFromSearchParams({
		view: searchParams.get("view") ?? initialView,
	});
	const [view, setView] = useState<PersonDetailView>(urlView);

	useEffect(() => {
		setView(urlView);
	}, [urlView]);

	return (
		<div className="flex flex-1 flex-col bg-background">
			<PersonDetailTopBar
				personId={personId}
				title={title}
				view={view}
				detailBasePath={basePath}
				onViewChange={setView}
			/>

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"relative flex-1 overflow-x-clip overflow-y-visible",
				)}
			>
				<article className="flex flex-1 flex-col">
					{view === "about" ? hero : null}

					<div hidden={view !== "about"}>{about}</div>
					<div hidden={view !== "filmography"}>{filmography}</div>
				</article>
			</section>
		</div>
	);
}
