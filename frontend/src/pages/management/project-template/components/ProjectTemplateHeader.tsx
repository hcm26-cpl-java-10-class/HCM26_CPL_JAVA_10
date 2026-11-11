import { GitBranch, LayoutTemplate } from "lucide-react";
import type { ReactNode } from "react";

export function ProjectTemplateHeader({ title, description, label = "Template library", module, children }: {
  title: string;
  description?: ReactNode;
  label?: string;
  module?: boolean;
  children?: ReactNode;
}) {
  const Icon = module ? GitBranch : LayoutTemplate;
  return <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-indigo-200/70
    bg-gradient-to-r from-indigo-50 via-background to-sky-50 p-4 shadow-sm sm:p-5
    dark:border-indigo-900/60 dark:from-indigo-950/50 dark:to-sky-950/30">
    <div className="flex min-w-0 flex-[1_1_16rem] items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{label}</p>
        <h1 className="mt-1 break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <div className="mt-1.5 break-words text-sm text-muted-foreground">{description}</div>}
      </div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>;
}
