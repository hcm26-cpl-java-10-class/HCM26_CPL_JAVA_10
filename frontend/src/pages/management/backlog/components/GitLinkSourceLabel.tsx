import { Pin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BacklogGitLinkInfo } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "@/pages/management/git-integration/git-integration.format";

const FIELD_LABEL: Record<string, string> = { TITLE: "from title", BODY: "from description", BRANCH: "from branch" };

/**
 * US-TM-03: why a pull request is on the task. Auto is plain muted text; Manual gets one
 * small sky accent (pin) so the two read apart at a glance without adding a badge.
 */
export function GitLinkSourceLabel({ link, className, iconOnly = false }: { link: BacklogGitLinkInfo; className?: string; iconOnly?: boolean }) {
  if (iconOnly) return <GitLinkSourceIcon link={link} className={className} />;
  if (link.source === "MANUAL") {
    const who = link.linkedByName ? ` by ${link.linkedByName}` : "";
    return <span className={cn("inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground", className)}
      title={`Linked manually${who}, ${formatDateTime(link.linkedAt)}. Stays linked even if the Task ID is removed from the pull request.`}>
      <Pin className="size-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
      <span className="font-medium text-sky-700 dark:text-sky-300">Manual</span>
      <span className="truncate">{who} · <time dateTime={link.linkedAt}>{formatRelative(link.linkedAt)}</time></span>
    </span>;
  }
  const field = link.field ? FIELD_LABEL[link.field] : null;
  return <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)}
    title="Linked automatically because the pull request mentions this Task ID. Removing the Task ID from the pull request removes the link.">
    <Sparkles className="size-3 shrink-0" aria-hidden="true" />
    Auto{field && <> · {field}</>}
  </span>;
}

/** Compact rows: just the icon (sky pin = manual, sparkles = auto); the wording is in the tooltip and for screen readers. */
function GitLinkSourceIcon({ link, className }: { link: BacklogGitLinkInfo; className?: string }) {
  const manual = link.source === "MANUAL";
  const field = link.field ? FIELD_LABEL[link.field] : null;
  const text = manual
    ? `Linked manually${link.linkedByName ? ` by ${link.linkedByName}` : ""}, ${formatDateTime(link.linkedAt)}`
    : `Linked automatically${field ? ` ${field}` : ""}`;
  const Icon = manual ? Pin : Sparkles;
  return <span className={cn("inline-flex shrink-0 items-center", className)} title={text}>
    <Icon className={cn("size-3", manual ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} aria-hidden="true" />
    <span className="sr-only">{text}</span>
  </span>;
}
