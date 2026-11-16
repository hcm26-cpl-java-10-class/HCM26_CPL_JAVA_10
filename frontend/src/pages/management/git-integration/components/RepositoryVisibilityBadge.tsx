import { Archive, Building2, Globe, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const VISIBILITY: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  private: {
    label: "Private",
    icon: Lock,
    // Most common: kept neutral so it doesn't compete with the repository name.
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  public: {
    label: "Public",
    icon: Globe,
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  },
  internal: {
    label: "Internal",
    icon: Building2,
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  },
};

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";

export function RepositoryVisibilityBadge({ visibility }: { visibility: string }) {
  const style = VISIBILITY[visibility] ?? VISIBILITY.private;
  const Icon = style.icon;
  return <span className={cn(PILL, style.className)}>
    <Icon className="size-3" aria-hidden="true" />{style.label}
  </span>;
}

export function RepositoryArchivedBadge() {
  return <span className={cn(PILL, "border-stone-200 bg-stone-100 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
    <Archive className="size-3" aria-hidden="true" />Archived
  </span>;
}

/** Visibility glyph shown before the repository name. */
export function RepositoryVisibilityIcon({ visibility, className }: { visibility: string; className?: string }) {
  const { icon: Icon } = VISIBILITY[visibility] ?? VISIBILITY.private;
  return <Icon className={className} aria-hidden="true" />;
}
