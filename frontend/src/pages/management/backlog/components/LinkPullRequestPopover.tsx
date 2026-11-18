import { Link2, Loader2, Plus, Search } from "lucide-react";
import { useDeferredValue, useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GitPullRequestCandidate } from "@/types/features/git-integration";
import { pullRequestDot } from "@/pages/management/git-integration/components/git-integration.styles";
import { useLinkPullRequest, usePullRequestCandidates } from "@/pages/management/git-integration/useGitIntegration";

const STATE_LABEL = { OPEN: "Open", MERGED: "Merged", CLOSED: "Closed" } as const;

function CandidateRow({ candidate, active, optionId, onPick, onHover }: {
  candidate: GitPullRequestCandidate; active: boolean; optionId: string; onPick: () => void; onHover: () => void;
}) {
  const state = candidate.state === "OPEN" && candidate.draft ? "Draft" : STATE_LABEL[candidate.state];
  return <li id={optionId} role="option" aria-selected={active} aria-disabled={candidate.alreadyLinked}
    onMouseEnter={onHover} onMouseDown={event => event.preventDefault()}
    onClick={() => { if (!candidate.alreadyLinked) onPick(); }}
    className={cn("flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5",
      active && !candidate.alreadyLinked && "bg-muted", candidate.alreadyLinked && "cursor-default opacity-60")}>
    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", pullRequestDot(candidate.state, candidate.draft))}
      aria-hidden="true" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-medium">
        <span className="text-muted-foreground">#{candidate.number}</span> {candidate.title}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground">
        {state}{candidate.authorLogin && <> · {candidate.authorLogin}</>}
        {candidate.linkedTaskKeys.length > 0 && <> · also on <span className="font-mono">{candidate.linkedTaskKeys.join(", ")}</span></>}
      </span>
    </span>
    {candidate.alreadyLinked && <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
      <Link2 className="size-3" aria-hidden="true" />Linked
    </span>}
  </li>;
}

/**
 * US-TM-03: link a pull request the text does not name. Search by #number or title,
 * pick with the mouse or ↑ ↓ Enter; at most two clicks from Task Detail.
 */
export function LinkPullRequestPopover({ itemId, taskKey, trigger }: {
  itemId: number; taskKey?: string | null; trigger?: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const query = useDeferredValue(text.trim());
  const candidates = usePullRequestCandidates(itemId, query, open);
  const link = useLinkPullRequest(itemId, taskKey);
  const listId = useId();
  const rows = candidates.data ?? [];
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) { setText(""); setActive(0); }
  };
  const pick = (candidate: GitPullRequestCandidate) => {
    if (candidate.alreadyLinked || link.isPending) return;
    link.mutate(candidate.number, { onSuccess: () => changeOpen(false) });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(Math.min(activeIndex + 1, rows.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    if (event.key === "Enter" && rows[activeIndex]) { event.preventDefault(); pick(rows[activeIndex]); }
  };

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      {trigger === "link"
        ? <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline">Link it</button>
        : <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]">
          <Plus className="size-3" aria-hidden="true" />Link PR
        </Button>}
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input autoFocus value={text} onChange={event => { setText(event.target.value); setActive(0); }} onKeyDown={onKeyDown}
          placeholder="Search #number or title" aria-label="Search pull requests" className="h-8 pl-7 text-xs"
          role="combobox" aria-expanded="true" aria-controls={listId}
          aria-activedescendant={rows[activeIndex] ? `${listId}-${rows[activeIndex].id}` : undefined} />
        {(candidates.isFetching || link.isPending) && <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      <ul id={listId} role="listbox" aria-label="Pull requests" className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
        {rows.map((candidate, index) => <CandidateRow key={candidate.id} candidate={candidate} active={index === activeIndex}
          optionId={`${listId}-${candidate.id}`} onPick={() => pick(candidate)} onHover={() => setActive(index)} />)}
      </ul>
      {!candidates.isPending && rows.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">
        {candidates.isError ? "Pull requests could not be loaded." : query ? `No pull request matches “${query}”.` : "No pull requests in this repository yet."}
      </p>}
      <p className="mt-2 border-t px-2 pt-2 text-[11px] text-muted-foreground">
        Manual links stay even if the Task ID is removed from the pull request.
      </p>
    </PopoverContent>
  </Popover>;
}
