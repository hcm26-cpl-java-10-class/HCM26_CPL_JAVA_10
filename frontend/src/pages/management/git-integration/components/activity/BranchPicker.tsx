import { useDebounce } from "@uidotdev/usehooks";
import { Check, ChevronDown, GitBranch, Loader2, Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatRelative } from "../../git-integration.format";
import { useRepositoryBranches } from "../../useGitIntegration";

/**
 * WS-GH-02: picks the branch the Commits view is filtered by. Branches load only while the
 * picker is open; ↑/↓ move, Enter picks, Esc closes. "All branches" clears the filter.
 */
export function BranchPicker({ projectId, value, onChange }: {
  projectId: number;
  value?: string;
  onChange: (branch: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebounce(search.trim(), 250);
  const query = useRepositoryBranches(projectId, q, open);
  const options: Array<{ name: string | undefined; commits?: number; lastCommitAt?: string | null }> = [
    { name: undefined }, ...(query.data ?? []).map(branch => ({ name: branch.name, commits: branch.commits, lastCommitAt: branch.lastCommitAt })),
  ];
  const current = Math.min(active, options.length - 1);

  function toggle(next: boolean) {
    setOpen(next);
    setSearch("");
    setActive(0);
  }

  function pick(name: string | undefined) {
    onChange(name);
    toggle(false);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(options[current]?.name);
    }
  }

  return <Popover open={open} onOpenChange={toggle}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className={cn("h-9 max-w-56 gap-1.5", value && "border-sky-300 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/40")}
        aria-label={value ? `Branch: ${value}. Change branch` : "Filter by branch"}>
        <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", value && "font-mono text-xs")}>{value ?? "All branches"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 p-0">
      <div className="relative border-b">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input autoFocus value={search} onChange={event => { setSearch(event.target.value); setActive(0); }} onKeyDown={onKey}
          placeholder="Find a branch" aria-label="Find a branch" maxLength={100} role="combobox" aria-expanded aria-controls="gh-branch-options"
          aria-activedescendant={`gh-branch-${current}`}
          className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0" />
        {query.isFetching && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      <ul id="gh-branch-options" role="listbox" aria-label="Branches" className="max-h-72 overflow-y-auto py-1">
        {options.map((option, index) => {
          const selected = option.name === value;
          return <li key={option.name ?? "__all"} id={`gh-branch-${index}`} role="option" aria-selected={selected}
            onMouseEnter={() => setActive(index)} onClick={() => pick(option.name)}
            className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm", index === current && "bg-muted")}>
            <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
            {option.name === undefined ? <span className="text-muted-foreground">All branches</span> : <>
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={option.name}>{option.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {option.commits} · {formatRelative(option.lastCommitAt)}
              </span>
            </>}
          </li>;
        })}
        {!query.isPending && query.data?.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">
          {q ? `No branch matches “${q}”.` : "No branches yet."}
        </li>}
        {query.isError && <li className="px-3 py-2 text-xs text-muted-foreground">Branches could not be loaded.</li>}
      </ul>
    </PopoverContent>
  </Popover>;
}
