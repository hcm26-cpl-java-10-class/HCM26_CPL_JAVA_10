import { createContext, useContext } from "react";
import type { BacklogGitLinkSummary } from "@/types/features/git-integration";

/** US-SY-05: link counts of the tasks of the current board, by task id (filled by `GitLinkSummaryProvider`). */
export const GitLinkSummaryContext = createContext<ReadonlyMap<number, BacklogGitLinkSummary>>(new Map());

export function useGitLinkSummaryOf(itemId: number): BacklogGitLinkSummary | undefined {
  return useContext(GitLinkSummaryContext).get(itemId);
}
