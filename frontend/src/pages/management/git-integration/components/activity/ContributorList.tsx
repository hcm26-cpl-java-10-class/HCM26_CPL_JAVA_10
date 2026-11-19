import type { GitContributorStat } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { contributorBar } from "../git-integration.styles";
import { ContributorAvatar } from "./ContributorAvatar";
import { RatioBar } from "./RatioBar";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * WS-GH-02: the people of the period with a ratio bar in their avatar's hue. A row opens the
 * Commits view filtered by that author (login, or name when the commits carry no login).
 */
export function ContributorList({ contributors, others, onSelect }: {
  contributors: GitContributorStat[];
  others: number;
  onSelect: (author: string) => void;
}) {
  if (contributors.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No contributors in this period.</p>;
  const max = Math.max(...contributors.map(person => person.commits));
  return <ul className="divide-y">
    {contributors.map(person => {
      const author = person.login ?? person.name ?? "";
      const tone = contributorBar(author);
      const details = [person.pullRequestsOpened > 0 && plural(person.pullRequestsOpened, "PR"),
        person.reviews > 0 && plural(person.reviews, "review")].filter(Boolean).join(" · ");
      return <li key={(person.login ? "l:" : "n:") + author}>
        <button type="button" onClick={() => onSelect(author)} title={`Show commits by ${author}`}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <ContributorAvatar login={author} className="size-7" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={person.matched ? "truncate text-[13px] font-medium" : "truncate text-[13px] font-medium italic"}
                title={person.matched ? undefined : "Commits use an e-mail that is not linked to a GitHub account"}>{author}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{person.commits}</span> {person.commits === 1 ? "commit" : "commits"}</span>
            </span>
            <RatioBar value={person.commits} max={max} track={tone.track} bar={tone.bar} />
            <span className="block truncate text-[11px] text-muted-foreground">
              {details}{details && person.lastActiveAt ? " · " : ""}
              {person.lastActiveAt && <>active <time dateTime={person.lastActiveAt} title={formatDateTime(person.lastActiveAt)}>{formatRelative(person.lastActiveAt)}</time></>}
            </span>
          </span>
        </button>
      </li>;
    })}
    {others > 0 && <li className="px-4 py-2 text-[11px] text-muted-foreground">+{plural(others, "more contributor")}</li>}
  </ul>;
}
