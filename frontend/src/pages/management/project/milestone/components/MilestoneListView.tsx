import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MilestoneDetailRouteState, MilestoneListItem } from "@/types";
import { ArrowRight, CalendarClock, ChevronRight, Clock, Flag } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  formatDateTime,
  formatPenalty,
  formatRelativeDeadline,
  isPastDeadline,
} from "../milestone.utils";
import { MilestoneStatusBadge } from "./MilestoneStatusBadge";

interface MilestoneListViewProps {
  milestones: MilestoneListItem[];
  projectId: string;
  projectName: string;
  returnTo: string;
  loading?: boolean;
  viewMode?: "table" | "card";
}

function LatePolicy({ milestone }: { milestone: MilestoneListItem }) {
  if (milestone.latePolicyType === "NO_LATE") {
    return <span className="text-muted-foreground">No late submissions</span>;
  }

  return (
    <div>
      <p className="font-medium">Until {formatDateTime(milestone.lateUntil)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatPenalty(milestone.latePenaltyPercent)} penalty</p>
    </div>
  );
}

function Deadline({ milestone }: { milestone: MilestoneListItem }) {
  const pastDue = isPastDeadline(milestone);
  return (
    <div>
      <p className="flex items-center gap-2 font-medium"><CalendarClock className="size-4 text-muted-foreground" /> {formatDateTime(milestone.deadline)}</p>
      <p className={pastDue ? "mt-1 text-xs font-medium text-destructive" : "mt-1 text-xs text-muted-foreground"}>
        {pastDue ? "Past due · " : ""}{formatRelativeDeadline(milestone.deadline)}
      </p>
    </div>
  );
}

export function MilestoneListView({
  milestones,
  projectId,
  projectName,
  returnTo,
  loading = false,
  viewMode = "table",
}: MilestoneListViewProps) {
  const navigate = useNavigate();
  const routeState: MilestoneDetailRouteState = { projectName, returnTo };
  const detailUrl = (milestoneId: string) => `/projects/${projectId}/milestones/${milestoneId}`;

  const openMilestone = (milestoneId: string) => navigate(detailUrl(milestoneId), { state: routeState });
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, milestoneId: string) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    openMilestone(milestoneId);
  };
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, milestoneId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMilestone(milestoneId);
  };

  return (
    <>
      <div
        className={cn(
          "h-full overflow-auto transition-opacity",
          viewMode === "table" ? "hidden md:block" : "hidden",
          loading && "pointer-events-none opacity-55",
        )}
        aria-busy={loading}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background shadow-xs">
            <TableRow>
              <TableHead className="w-[38%] px-4">Milestone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Late policy</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12"><span className="sr-only">Open</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map((milestone, index) => (
              <TableRow
                key={milestone.id}
                tabIndex={0}
                aria-label={`Open ${milestone.title}`}
                className={cn(
                  "group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  index % 2 === 0 ? "bg-accent" : "bg-background",
                )}
                onClick={(event) => handleRowClick(event, milestone.id)}
                onKeyDown={(event) => handleRowKeyDown(event, milestone.id)}
              >
                <TableCell className="whitespace-normal px-4 py-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0">
                      <Link to={detailUrl(milestone.id)} state={routeState} className="font-semibold hover:text-primary hover:underline">
                        {milestone.title}
                      </Link>
                      {milestone.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{milestone.description}</p> : null}
                    </div>
                    {milestone.mandatory ? <Badge variant="secondary">Mandatory</Badge> : null}
                  </div>
                </TableCell>
                <TableCell><MilestoneStatusBadge status={milestone.status} /></TableCell>
                <TableCell className="whitespace-normal"><Deadline milestone={milestone} /></TableCell>
                <TableCell className="whitespace-normal"><LatePolicy milestone={milestone} /></TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(milestone.createdAt)}</TableCell>
                <TableCell>
                  <Button asChild size="icon-sm" variant="ghost" aria-label={`View ${milestone.title}`}>
                    <Link to={detailUrl(milestone.id)} state={routeState}><ChevronRight /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div
        className={cn(
          "grid flex-1 gap-3 overflow-y-auto p-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          viewMode === "table" && "md:hidden",
          loading && "pointer-events-none opacity-55",
        )}
        aria-busy={loading}
      >
        {milestones.map((milestone) => (
          <Card
            key={milestone.id}
            className="group relative cursor-pointer overflow-hidden border-border/70 bg-gradient-to-b from-background to-muted/30 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            role="link"
            tabIndex={0}
            onClick={() => openMilestone(milestone.id)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openMilestone(milestone.id);
              }
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-100 via-cyan-100 to-emerald-100 dark:from-sky-900/30 dark:via-cyan-900/20 dark:to-emerald-900/30" />
            <CardContent className="relative grid h-full gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <Flag className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><MilestoneStatusBadge status={milestone.status} />{milestone.mandatory ? <Badge variant="secondary">Mandatory</Badge> : null}</div>
                    <h2 className="mt-2 line-clamp-1 font-semibold">{milestone.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{milestone.description || "No description available."}</p>
                  </div>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" /> Deadline</p><div className="mt-1"><Deadline milestone={milestone} /></div></div>
                <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> Late policy</p><div className="mt-1"><LatePolicy milestone={milestone} /></div></div>
              </div>
              <Button asChild type="button" size="sm" variant="outline" className="mt-auto w-full justify-between">
                <Link to={detailUrl(milestone.id)} state={routeState} onClick={(event) => event.stopPropagation()}>
                  View detail <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
