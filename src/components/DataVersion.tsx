"use client";

import { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const DataVersionContext = createContext("none");
/** Which version of the shared catalogue data (products, workshops, makers) the server rendered this page from. Part of every cached query key. */
export const useDataVersion = () => useContext(DataVersionContext);

/** Root of every cached catalogue query key: ["data", version, ...]. */
export const dataKey = (version: string, ...rest: unknown[]) => ["data", version, ...rest] as const;

/**
 * Tells the queries below which data version this page was rendered from. When the server hands out a new version
 * (after an admin or seller changed something) everything fetched for older versions is dropped, so the next look refetches.
 */
export function DataVersionProvider({ version, children }: { version: string; children: React.ReactNode }) {
  const client = useQueryClient();
  useEffect(() => {
    client.removeQueries({ queryKey: ["data"], predicate: (q) => q.queryKey[1] !== version });
  }, [client, version]);
  return <DataVersionContext.Provider value={version}>{children}</DataVersionContext.Provider>;
}
