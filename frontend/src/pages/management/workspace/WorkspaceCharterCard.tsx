import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";
import { projectHubApi } from "@/api/features/project-hub.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { charterProgressLabel } from "./team-charter.utils";
import { getWorkspaceError } from "./workspace.shared";

export function WorkspaceCharterCard({teamId, workspaceId}: {teamId: number; workspaceId: number}) {
  const {user, activeRole} = usePermissions();
  const charter = useQuery({queryKey: ["team-charter", teamId, workspaceId, user.email, activeRole], queryFn: () => projectHubApi.getCharter(teamId, workspaceId), retry: false});
  const data = charter.isSuccess ? charter.data : undefined;
  const total = data?.memberCount;
  const confirmed = data?.confirmedCount;
  const hasCounts = typeof total === "number" && Number.isInteger(total) && total > 0
    && typeof confirmed === "number" && Number.isInteger(confirmed) && confirmed >= 0 && confirmed <= total;
  const percent = hasCounts ? Math.round(confirmed / total * 100) : null;
  const fullyConfirmed = hasCounts && confirmed === total && data?.progress === "FULLY_CONFIRMED";
  const progressLabel = data?.progress === "FULLY_CONFIRMED" && !fullyConfirmed ? undefined
    : data?.progress === "NEEDS_REVIEW" && !data.charter ? "Needs review"
    : data?.progress ? charterProgressLabel(data) : undefined;
  const statusColor = fullyConfirmed
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
    : data?.progress === "PENDING" || data?.progress === "NEEDS_REVIEW"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "";
  const confirmationText = hasCounts ? `${confirmed} of ${total} members confirmed`
    : total === 0 ? "No member assignments" : "Confirmation progress unavailable";

  return (
    <Card className="@container min-w-0 gap-0 py-0" aria-busy={charter.isPending}>
      <CardContent className="flex min-w-0 flex-col gap-3 px-4 py-3 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:justify-between sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <BookOpen aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-sm leading-5">Team charter</CardTitle>
            <p className="text-sm text-muted-foreground">Review working rules, roles and member confirmations.</p>
            {charter.isPending ? (
              <div role="status">
                <span className="sr-only">Loading charter progress…</span>
                <div className="flex flex-wrap gap-2" aria-hidden="true"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-32" /></div>
              </div>
            ) : charter.isError ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span role="alert">{getWorkspaceError(charter.error)}</span>
                <Button variant="outline" size="sm" disabled={charter.isFetching} onClick={() => void charter.refetch()}>Try again</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {data?.revision != null && <Badge variant="secondary">{data.revision > 0 ? `Revision ${data.revision}` : "No saved revision"}</Badge>}
                  {data?.workflow && <Badge variant="outline">{data.publishedCharter ? `In effect: revision ${data.publishedCharter.revision}` : "No published charter"}</Badge>}
                  {data?.teamStatus === "ARCHIVED" && <Badge variant="outline">Archived</Badge>}
                  {progressLabel && <Badge variant="outline" className={statusColor}>{progressLabel}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{confirmationText}</span>
                  {percent != null && <Progress
                    value={percent}
                    aria-label="Current revision confirmation progress"
                    aria-valuenow={percent}
                    aria-valuetext={confirmationText}
                    className={`h-1.5 w-24 bg-muted sm:w-28 ${fullyConfirmed ? "[&_[data-slot=progress-indicator]]:bg-emerald-600" : "[&_[data-slot=progress-indicator]]:bg-blue-600"}`}
                  />}
                </div>
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link to={`/student/team/charter?teamId=${teamId}&workspaceId=${workspaceId}`}>Open team charter<ChevronRight /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
