import { Copy, Mail, MoreHorizontal, Unlink, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  GitAccountActivity, GitAccountMember, GitAccountsOverview, GitUnmappedContributor,
} from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { clearGitHubTabParams, GITHUB_TAB } from "../../github-tab.params";
import { useAssignContributor, useUnlinkAccount } from "../../useGitIntegration";
import { ContributorAvatar } from "../activity/ContributorAvatar";
import { AssignMemberPopover } from "./AssignMemberPopover";
import { ConnectAccountButton } from "./ConnectAccountBanner";
import { ACCOUNT_TONES, GitHubAccountChip, NotConnectedChip } from "./GitHubAccountChip";

const UNDO_MS = 6000;

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "Whole project" for a team on the master, else the modules (two at most, then "+N"). */
function projectsLabel(member: GitAccountMember, masterId: number) {
  if (member.projects.some(project => project.id === masterId)) return "Whole project";
  const codes = member.projects.map(project => project.code ?? project.name ?? "");
  return codes.length > 2 ? `${codes.slice(0, 2).join(", ")} +${codes.length - 2}` : codes.join(", ");
}

function ActivityLine({ activity }: { activity: GitAccountActivity }) {
  const parts = [activity.commits > 0 && plural(activity.commits, "commit"),
    activity.pullRequests > 0 && plural(activity.pullRequests, "PR"),
    activity.reviews > 0 && plural(activity.reviews, "review")].filter(Boolean);
  if (parts.length === 0) return <span className="text-muted-foreground/70">No activity yet</span>;
  return <>
    <span className="tabular-nums">{parts.join(" · ")}</span>
    {activity.lastActiveAt && <> · <time dateTime={activity.lastActiveAt} title={formatDateTime(activity.lastActiveAt)}>{formatRelative(activity.lastActiveAt)}</time></>}
  </>;
}

function SectionHeader({ icon, title, hint, accent }: { icon: ReactNode; title: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5",
    accent && "border-b-amber-200/80 bg-amber-50/30 dark:border-b-amber-900/60 dark:bg-amber-950/10")}>
    <h3 className="flex items-center gap-2 text-[13px] font-semibold">{icon}{title}</h3>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>;
}

/**
 * US-GI-06: the Members view of the GitHub tab. Members first (not connected on top), then the
 * contributors nobody is mapped to. A PM assigns an e-mail in two clicks with Undo in the toast;
 * only unlinking a GitHub account asks for confirmation, since the PM cannot redo it (BR4).
 */
export function MembersView({ projectId, overview, loading, error, onRetry, highlight }: {
  projectId: number;
  overview?: GitAccountsOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  highlight?: number;
}) {
  const location = useLocation();
  const assign = useAssignContributor(projectId);
  const unlink = useUnlinkAccount(projectId);
  const [unlinking, setUnlinking] = useState<GitAccountMember | null>(null);

  if (loading) {
    return <div role="status" aria-label="Loading members" className="space-y-2 rounded-xl border p-4">
      {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-11 w-full" />)}
    </div>;
  }
  if (error || !overview) {
    return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
      The project's GitHub accounts could not be loaded.
      <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={onRetry}>Try again</button>
    </div>;
  }

  const { viewer, members, unmapped, summary } = overview;
  const canManage = viewer.canManage;

  function inviteLink() {
    const params = clearGitHubTabParams(new URLSearchParams(location.search));
    params.set("tab", GITHUB_TAB);
    const url = `${window.location.origin}${location.pathname}?${params.toString()}`;
    navigator.clipboard?.writeText(url)
      .then(() => toast.success("Invite link copied", { description: "Send it to the member: the GitHub tab will offer to connect their account." }))
      .catch(() => toast.info("Copy this link", { description: url }));
  }

  function assignTo(row: GitUnmappedContributor, member: GitAccountMember) {
    const label = row.email ?? row.login ?? "Contributor";
    assign.mutate({ contributorId: row.contributorId, userId: member.userId }, {
      onSuccess: () => toast.success(`Assigned ${label} to ${member.name}`, {
        duration: UNDO_MS,
        action: { label: "Undo", onClick: () => assign.mutate({ contributorId: row.contributorId, userId: null }) },
      }),
    });
  }

  function removeEmail(member: GitAccountMember, contributorId: number, email: string | null) {
    assign.mutate({ contributorId, userId: null }, {
      onSuccess: () => toast.success(`Removed ${email ?? "e-mail"} from ${member.name}`, {
        duration: UNDO_MS,
        action: { label: "Undo", onClick: () => assign.mutate({ contributorId, userId: member.userId }) },
      }),
    });
  }

  function confirmUnlink() {
    if (!unlinking) return;
    const member = unlinking;
    unlink.mutate(member.userId, {
      onSuccess: () => toast.success(`Unlinked @${member.github?.login ?? "GitHub"} from ${member.name}`, {
        description: "Their activity is kept and shows as unmapped. They can connect again any time.",
      }),
      onSettled: () => setUnlinking(null),
    });
  }

  return <div className="min-w-0 space-y-4">
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-border">
      <SectionHeader icon={<Users className="size-4 text-muted-foreground" aria-hidden="true" />}
        title={<>Members <span className="font-normal text-muted-foreground">· {summary.members}</span></>}
        hint={<><span className="font-semibold text-emerald-700 dark:text-emerald-300">{summary.connected}</span> of {summary.members} connected to GitHub</>} />
      {members.length === 0
        ? <p className="px-4 py-6 text-sm text-muted-foreground">No members yet. Members of the project's teams appear here.</p>
        : <ul className="divide-y">
          {members.map(member => {
            const self = member.userId === viewer.userId;
            const menu = (canManage || self) && (member.github || (canManage && member.emails.length > 0));
            return <li key={member.userId} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5", !member.member && "opacity-70")}>
              <ContributorAvatar login={member.name} className="size-8" />
              <div className="min-w-0 flex-1 basis-48">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <span className="truncate font-medium">{member.name}{self && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {member.member ? [member.roles.join(", "), projectsLabel(member, overview.master.id)].filter(Boolean).join(" · ") : "No longer in the project"}
                  </span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground"><ActivityLine activity={member.activity} /></p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {member.github
                  ? <GitHubAccountChip login={member.github.login}
                    title={`${member.github.source === "MANUAL" ? "Assigned" : "Connected"}${member.github.mappedAt ? ` ${formatDateTime(member.github.mappedAt)}` : ""} · applies to ${overview.master.name ?? "the project"} and all its modules`} />
                  : member.member && <NotConnectedChip />}
                {member.emails.map(email => <span key={email.contributorId} title={email.mappedByName ? `Assigned by ${email.mappedByName}` : undefined}
                  className={cn("inline-flex max-w-52 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", ACCOUNT_TONES.neutral)}>
                  <Mail className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{email.email}</span>
                </span>)}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {self && !member.github && member.member && viewer.canConnect &&
                  <ConnectAccountButton projectId={projectId} login={viewer.identity?.login} variant="outline" />}
                {!member.github && member.member && !self && canManage &&
                  <Button variant="ghost" size="sm" className="h-8 text-sky-700 hover:text-sky-800 dark:text-sky-300" onClick={inviteLink}>
                    <Copy />Invite link
                  </Button>}
                {menu && <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${member.name}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    {member.github && <DropdownMenuItem className="text-red-600 focus:text-red-700 dark:text-red-400" onSelect={() => setUnlinking(member)}>
                      <Unlink />Unlink GitHub account
                    </DropdownMenuItem>}
                    {canManage && member.emails.length > 0 && <>
                      {member.github && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Assigned e-mails</DropdownMenuLabel>
                      {member.emails.map(email => <DropdownMenuItem key={email.contributorId}
                        onSelect={() => removeEmail(member, email.contributorId, email.email)}>
                        <Mail /><span className="truncate">Remove {email.email}</span>
                      </DropdownMenuItem>)}
                    </>}
                  </DropdownMenuContent>
                </DropdownMenu>}
              </div>
            </li>;
          })}
        </ul>}
    </div>

    {unmapped.length > 0 && <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-border">
      <SectionHeader accent icon={<span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />}
        title={<>Unmapped contributors <span className="font-normal text-muted-foreground">· {unmapped.length}</span></>}
        hint={canManage ? "Activity here counts for nobody yet" : "Ask your PM to assign these"} />
      <ul className="divide-y">
        {unmapped.map(row => {
          const label = row.kind === "GITHUB" ? `@${row.login ?? "github"}` : row.email ?? row.displayName ?? "Unknown";
          return <li key={row.contributorId}
            ref={node => { if (node && row.contributorId === highlight) node.scrollIntoView({ block: "center" }); }}
            className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5",
              row.contributorId === highlight && "bg-sky-50/60 ring-2 ring-inset ring-sky-300 dark:bg-sky-950/30 dark:ring-sky-800")}>
            <ContributorAvatar login={row.login ?? row.displayName ?? row.email} className="size-8" />
            <div className="min-w-0 flex-1 basis-48">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="truncate font-medium">{label}</span>
                {row.displayName && row.kind === "EMAIL" && <span className="text-[11px] text-muted-foreground">{row.displayName}</span>}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {row.kind === "GITHUB" ? "GitHub account" : "E-mail only"} · <ActivityLine activity={row.activity} />
              </p>
            </div>
            <div className="w-full sm:ml-auto sm:w-auto">
              {row.kind === "GITHUB"
                ? <span className="text-[11px] text-muted-foreground" title="A GitHub account is linked only by its owner, from the GitHub tab.">
                  Waiting for the owner to connect
                </span>
                : canManage
                  ? <AssignMemberPopover members={members} suggestedUserId={row.suggestedUserId} disabled={assign.isPending}
                    onAssign={member => assignTo(row, member)} />
                  : null}
            </div>
          </li>;
        })}
      </ul>
    </div>}

    <ConfirmDialog open={unlinking !== null} destructive loading={unlink.isPending}
      title={unlinking?.userId === viewer.userId ? "Unlink your GitHub account?" : `Unlink ${unlinking?.name}'s GitHub account?`}
      description={<>
        Commits, pull requests and reviews of <span className="font-medium">@{unlinking?.github?.login}</span> are kept and will show as unmapped.
        {unlinking?.userId !== viewer.userId && " Only the member can connect it again."}
      </>}
      confirmLabel="Unlink" loadingLabel="Unlinking…" onConfirm={confirmUnlink} onCancel={() => setUnlinking(null)} />
  </div>;
}
