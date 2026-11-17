import { CircleSlash, Link2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitTaskRef } from "@/types/features/git-integration";

const CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";
const LINKED = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
const WARNING = "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
const NEUTRAL = "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

function describe(ref: GitTaskRef): { label: string; title: string } {
  if (ref.status === "LINKED") return { label: ref.key ?? "", title: ref.itemTitle ? `${ref.key} · ${ref.itemTitle}` : `Linked to ${ref.key}` };
  if (ref.status === "MISSING") return { label: "No task ID", title: "The message does not mention any Task ID, so it is not linked to a task." };
  if (ref.status === "OUTSIDE_PROJECT") return { label: `${ref.key} · other project`, title: `${ref.key} belongs to another project, so it was not linked.` };
  if (ref.reason === "DELETED") return { label: `${ref.key} · deleted`, title: `${ref.key} was deleted, so it was not linked.` };
  return { label: `${ref.key} · not found`, title: `No task ${ref.key} exists, so nothing was linked.` };
}

/**
 * US-SY-05: the Task IDs a commit or pull request mentions, with why one was not linked
 * (Missing / Invalid / Outside project). Text plus icon: colour is only a hint.
 */
export function TaskRefChips({ refs, className }: { refs: GitTaskRef[]; className?: string }) {
  if (refs.length === 0) return null;
  return <span className={cn("flex flex-wrap items-center gap-1", className)}>
    {refs.map(ref => {
      const { label, title } = describe(ref);
      const Icon = ref.status === "LINKED" ? Link2 : ref.status === "MISSING" ? CircleSlash : TriangleAlert;
      return <span key={`${ref.status}-${ref.key ?? "none"}`} title={title}
        className={cn(CHIP, ref.status === "LINKED" ? LINKED : ref.status === "MISSING" ? NEUTRAL : WARNING)}>
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", ref.key && "font-mono")}>{label}</span>
        <span className="sr-only">{title}</span>
      </span>;
    })}
  </span>;
}
