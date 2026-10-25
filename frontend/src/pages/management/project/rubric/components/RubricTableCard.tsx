import type { EntityCardRendererProps, RubricListItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { RubricStatusBadge } from "./RubricStatusBadge";

export function RubricTableCard({
  row,
  showActions = true,
  onView,
  renderRowActions,
}: EntityCardRendererProps) {
  const rubric = row as RubricListItem;

  const openDetail = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label, [role=switch]")) return;
    onView(row);
  };

  return (
    <Card
      className="group relative h-full cursor-pointer overflow-hidden border-border/70 bg-gradient-to-b from-background to-muted/30 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      onClick={openDetail}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-violet-100 via-indigo-100 to-sky-100 dark:from-violet-900/30 dark:via-indigo-900/20 dark:to-sky-900/30" />

      <CardHeader className="relative gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <RubricStatusBadge status={rubric.latestStatus} />
            <Badge variant="outline">v{rubric.latestVersionNumber}</Badge>
          </div>
          {showActions && renderRowActions ? (
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              {renderRowActions(row)}
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <FileCheck2 className="size-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="line-clamp-1 text-base leading-tight">{rubric.name}</CardTitle>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {rubric.description || "No description available."}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-3 gap-2 pt-0 text-center">
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-lg font-semibold">{rubric.criteriaCount}</p>
          <p className="text-[11px] text-muted-foreground">Criteria</p>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-lg font-semibold">{rubric.totalMaxScore}</p>
          <p className="text-[11px] text-muted-foreground">Max score</p>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <p className="text-lg font-semibold">{rubric.milestoneUsageCount}</p>
          <p className="text-[11px] text-muted-foreground">Milestones</p>
        </div>
      </CardContent>

      <CardFooter className="mt-auto pt-0">
        <div className="grid w-full gap-2">
          <p className={rubric.latestStatus === "PUBLISHED" ? "text-xs text-emerald-700 dark:text-emerald-400" : "text-xs text-amber-700 dark:text-amber-400"}>
            {rubric.latestStatus === "PUBLISHED"
              ? "Available to milestones · immutable"
              : "Not available to milestones until published"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-between"
            onClick={(event) => {
              event.stopPropagation();
              onView(row);
            }}
          >
            View detail
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
