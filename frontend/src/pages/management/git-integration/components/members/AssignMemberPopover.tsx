import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GitAccountMember } from "@/types/features/git-integration";
import { ContributorAvatar } from "../activity/ContributorAvatar";

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/gi, "d").toLowerCase();
}

/**
 * US-GI-06 AC11: picks the member an e-mail-only contributor belongs to. The suggested member
 * (same e-mail or name) is listed first; nothing happens until the PM clicks a name.
 */
export function AssignMemberPopover({ members, suggestedUserId, disabled, onAssign }: {
  members: GitAccountMember[];
  suggestedUserId: number | null;
  disabled?: boolean;
  onAssign: (member: GitAccountMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const text = normalize(query.trim());
    return members
      .filter(member => member.member)
      .filter(member => !text || normalize(`${member.name} ${member.email ?? ""}`).includes(text))
      .sort((a, b) => Number(b.userId === suggestedUserId) - Number(a.userId === suggestedUserId));
  }, [members, query, suggestedUserId]);
  const suggested = members.find(member => member.userId === suggestedUserId);

  function choose(member: GitAccountMember) {
    setOpen(false);
    setQuery("");
    onAssign(member);
  }

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(""); }}>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className="h-8 w-full justify-between gap-2 sm:w-auto" disabled={disabled}>
        {suggested ? <span className="truncate">Assign to <span className="font-semibold">{suggested.name}</span>?</span> : "Assign to…"}
        <ChevronDown className="opacity-60" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72 p-0">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search members"
          aria-label="Search members" className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          onKeyDown={event => { if (event.key === "Enter" && options[0]) { event.preventDefault(); choose(options[0]); } }} />
      </div>
      <ul role="listbox" aria-label="Members" className="max-h-64 overflow-y-auto py-1">
        {options.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No member matches “{query}”.</li>}
        {options.map(member => {
          const isSuggested = member.userId === suggestedUserId;
          return <li key={member.userId} role="option" aria-selected={isSuggested}>
            <button type="button" onClick={() => choose(member)}
              className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                isSuggested && "bg-sky-50/70 dark:bg-sky-950/40")}>
              <ContributorAvatar login={member.name} className="size-6" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{member.name}</span>
                {member.email && <span className="block truncate text-[11px] text-muted-foreground">{member.email}</span>}
              </span>
              {isSuggested && <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                <Sparkles className="size-3" aria-hidden="true" />Suggested
              </span>}
              {!isSuggested && <Check className="size-3.5 shrink-0 opacity-0" aria-hidden="true" />}
            </button>
          </li>;
        })}
      </ul>
    </PopoverContent>
  </Popover>;
}
