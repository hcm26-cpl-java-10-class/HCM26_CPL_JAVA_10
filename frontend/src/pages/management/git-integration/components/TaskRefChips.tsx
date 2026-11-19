import { CircleSlash, Link2, Link2Off, Pin, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitTaskRef } from "@/types/features/git-integration";

const CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";
const LINKED = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
const WARNING = "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
const OPENABLE = "cursor-pointer transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-emerald-800 dark:hover:bg-emerald-900";
const NEUTRAL = "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

const FIELD: Record<string, string> = { MESSAGE: "from the message", TITLE: "from the title", BODY: "from the description", BRANCH: "from the branch" };

function describe(ref: GitTaskRef): { label: string; title: string } {
  if (ref.status === "LINKED") {
    const how = ref.source === "MANUAL" ? "linked manually"
      : ref.field === "MERGED_PR" ? `from merged pull request ${ref.rawText ?? ""}`.trim() : FIELD[ref.field] ?? "linked";
    return { label: ref.key ?? "", title: `${ref.key}${ref.itemTitle ? ` · ${ref.itemTitle}` : ""} (${how})` };
  }
  if (ref.status === "EXCLUDED") return { label: `${ref.key} · unlinked`, title: `Someone unlinked this pull request from ${ref.key}, so it is not linked again automatically.` };
  if (ref.status === "MISSING") return { label: "No task ID", title: "The message does not mention any Task ID, so it is not linked to a task." };
  if (ref.status === "OUTSIDE_PROJECT") return { label: `${ref.key} · other project`, title: `${ref.key} belongs to another project, so it was not linked.` };
  if (ref.reason === "DELETED") return { label: `${ref.key} · deleted`, title: `${ref.key} was deleted, so it was not linked.` };
  return { label: `${ref.key} · not found`, title: `No task ${ref.key} exists, so nothing was linked.` };
}

/**
 * US-SY-05 / US-TM-03: the Task IDs a commit or pull request mentions, with why one was not
 * linked (Missing / Invalid / Outside project / Unlinked), plus tasks linked manually (pin).
 * Text plus icon: colour is only a hint. With `onOpen`, a linked chip is a button that opens its task (WS-GH-01).
 */
export function TaskRefChips({ refs, className, onOpen }: { refs: GitTaskRef[]; className?: string; onOpen?: (ref: GitTaskRef) => void }) {
  if (refs.length === 0) return null;
  return <span className={cn("flex flex-wrap items-center gap-1", className)}>
    {refs.map(ref => {
      const { label, title } = describe(ref);
      const Icon = ref.status === "LINKED" ? (ref.source === "MANUAL" ? Pin : Link2)
        : ref.status === "MISSING" ? CircleSlash : ref.status === "EXCLUDED" ? Link2Off : TriangleAlert;
      const tone = ref.status === "LINKED" ? LINKED : ref.status === "MISSING" || ref.status === "EXCLUDED" ? NEUTRAL : WARNING;
      const key = `${ref.status}-${ref.key ?? "none"}-${ref.source ?? ""}`;
      const content = <>
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", ref.key && "font-mono", ref.status === "EXCLUDED" && "line-through decoration-slate-400")}>{label}</span>
        <span className="sr-only">{title}</span>
      </>;
      if (onOpen && ref.status === "LINKED" && ref.itemId != null) {
        return <button key={key} type="button" title={`${title} · open task`} onClick={() => onOpen(ref)}
          className={cn(CHIP, tone, OPENABLE)}>{content}</button>;
      }
      return <span key={key} title={title} className={cn(CHIP, tone)}>{content}</span>;
    })}
  </span>;
}
