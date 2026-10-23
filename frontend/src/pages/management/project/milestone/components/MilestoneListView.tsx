import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MilestoneDetailRouteState, MilestoneListItem } from "@/types";
import { CalendarClock, ChevronRight, Clock } from "lucide-react";
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
      <div className={`hidden transition-opacity md:block ${loading ? "pointer-events-none opacity-55" : ""}`} aria-busy={loading}>
        <Table>
          <TableHeader className="bg-muted/40">
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
            {milestones.map((milestone) => (
              <TableRow
                key={milestone.id}
                tabIndex={0}
                aria-label={`Open ${milestone.title}`}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
                <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={`grid gap-3 p-3 transition-opacity md:hidden ${loading ? "pointer-events-none opacity-55" : ""}`} aria-busy={loading}>
        {milestones.map((milestone) => (
          <Link key={milestone.id} to={detailUrl(milestone.id)} state={routeState} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="transition-colors hover:bg-muted/30">
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><MilestoneStatusBadge status={milestone.status} />{milestone.mandatory ? <Badge variant="secondary">Mandatory</Badge> : null}</div>
                    <h2 className="mt-3 font-semibold">{milestone.title}</h2>
                    {milestone.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{milestone.description}</p> : null}
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                  <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" /> Deadline</p><div className="mt-1"><Deadline milestone={milestone} /></div></div>
                  <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> Late policy</p><div className="mt-1"><LatePolicy milestone={milestone} /></div></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
