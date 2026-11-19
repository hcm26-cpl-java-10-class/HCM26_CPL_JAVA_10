import { toast } from "sonner";
import type { GitPullRequestItem, LinkedPullRequest } from "@/types/features/git-integration";

/** Which list the Development "View all" view opens on. */
export type DevelopmentTab = "pulls" | "commits";

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`, { description: text });
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

/** Needs action first: changes requested, then open, draft, merged, closed. */
function rank(pr: GitPullRequestItem) {
  if (pr.state === "OPEN") return pr.reviewSummary.changesRequested > 0 ? 0 : pr.draft ? 2 : 1;
  return pr.state === "MERGED" ? 3 : 4;
}

/** The task's pull requests by what needs attention; the server's newest-first order is kept within a group. */
export function rankPullRequests(rows: LinkedPullRequest[]) {
  return rows.map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row.pullRequest) - rank(b.row.pullRequest) || a.index - b.index)
    .map(entry => entry.row);
}
