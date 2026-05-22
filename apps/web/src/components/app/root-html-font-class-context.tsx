"use client";

import { createContext, type ReactNode, useContext } from "react";

const RootHtmlFontClassContext = createContext("");

export function RootHtmlFontClassProvider({
	fontClass,
	children,
}: {
	fontClass: string;
	children: ReactNode;
}) {
	return (
		<RootHtmlFontClassContext.Provider value={fontClass}>
			{children}
		</RootHtmlFontClassContext.Provider>
	);
}

export function useRootHtmlFontClass(): string {
	return useContext(RootHtmlFontClassContext);
}
