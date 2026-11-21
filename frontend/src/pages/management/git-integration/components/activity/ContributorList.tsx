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
 * US-GI-06: a person mapped to a project member shows the member's name (GitHub account and
 * assigned e-mails together); an unmapped one carries an amber dot and, for a PM, opens the
 * Members view to be assigned.
 */
export function ContributorList({ contributors, others, onSelect, onOpenContributor }: {
  contributors: GitContributorStat[];
  others: number;
  onSelect: (author: string) => void;
  onOpenContributor?: (contributorId: number) => void;
}) {
  if (contributors.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No contributors in this period.</p>;
  const max = Math.max(...contributors.map(person => person.commits));
  return <ul className="divide-y">
    {contributors.map(person => {
      const author = person.login ?? person.name ?? "";
      const tone = contributorBar(author);
      const display = person.memberName ?? author;
      const openMembers = !person.mapped && person.contributorId != null && onOpenContributor;
      const unmappedHint = person.mapped ? undefined
        : person.matched ? "Not linked to a project member" : "Commits use an e-mail that is not linked to a GitHub account";
      const details = [person.pullRequestsOpened > 0 && plural(person.pullRequestsOpened, "PR"),
        person.reviews > 0 && plural(person.reviews, "review")].filter(Boolean).join(" · ");
      return <li key={person.userId != null ? `u:${person.userId}` : (person.login ? "l:" : "n:") + author}>
        <button type="button" onClick={() => openMembers ? openMembers(person.contributorId!) : onSelect(author)}
          title={openMembers ? `Open ${author} in Members` : `Show commits by ${display}`}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <ContributorAvatar login={author} className="size-7" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className={person.mapped || person.matched ? "truncate text-[13px] font-medium" : "truncate text-[13px] font-medium italic"}
                  title={unmappedHint}>{display}</span>
                {person.memberName && person.login && <span className="truncate text-[11px] text-muted-foreground">@{person.login}</span>}
                {!person.mapped && <span className="size-1.5 shrink-0 self-center rounded-full bg-amber-500" title={unmappedHint} aria-label="Not linked to a member" />}
              </span>
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
