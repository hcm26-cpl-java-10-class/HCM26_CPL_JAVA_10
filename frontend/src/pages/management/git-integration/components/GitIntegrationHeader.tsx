import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa6";

/** GitHub-black tile used as the module's visual anchor (inverted in dark mode). */
export function GitHubTile({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-9" : "size-10";
  const icon = size === "sm" ? "size-4" : "size-5";
  return <span aria-hidden="true"
    className={`flex ${box} shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900`}>
    <FaGithub className={icon} />
  </span>;
}

/** Page header in the same shape as the other Project Management pages. */
export function GitIntegrationHeader({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">
      <GitHubTile />
      <div className="min-w-0">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
