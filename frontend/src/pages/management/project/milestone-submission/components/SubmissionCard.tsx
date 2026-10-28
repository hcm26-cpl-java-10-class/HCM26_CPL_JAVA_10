import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntityCardRendererProps, SubmissionListItem } from "@/types";
import { ArrowRight, Clock3, FileCheck2, Users } from "lucide-react";
import { ExecutionStatusBadge, SubmissionStatusBadge } from "./SubmissionStatusBadge";

export function SubmissionCard({ row, onView, renderRowActions, showActions = true }: EntityCardRendererProps) {
  const item = row as SubmissionListItem;
  return (
    <Card className="h-full cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => onView(row)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2"><SubmissionStatusBadge status={item.status} /><ExecutionStatusBadge status={item.executionStatus} /></div>
          {showActions && renderRowActions ? <div onClick={(e) => e.stopPropagation()}>{renderRowActions(row)}</div> : null}
        </div>
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FileCheck2 className="size-5" /></div>
          <div className="min-w-0"><CardTitle className="line-clamp-2 text-base">{item.milestoneTitle}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Version {item.currentVersionNumber}</p></div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" /> Team</p><p className="mt-1 font-medium">{item.teamName}</p><p className="text-xs text-muted-foreground">{item.studentName}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" /> Submitted</p><p className="mt-1 font-medium">{item.submittedAt ? new Date(item.submittedAt).toLocaleString("en-GB") : "Not submitted"}</p>{item.late ? <Badge variant="destructive" className="mt-1">Late · {item.penaltyPercent}%</Badge> : null}</div>
      </CardContent>
      <CardFooter><Button variant="outline" size="sm" className="w-full justify-between" onClick={(e) => { e.stopPropagation(); onView(row); }}>{item.status === "SUBMITTED" ? "Start review" : "View review result"} <ArrowRight className="size-4" /></Button></CardFooter>
    </Card>
  );
}
