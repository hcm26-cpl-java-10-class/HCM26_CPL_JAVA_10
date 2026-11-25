import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsLoading } from "@/pages/management/demo/analytics/components/AnalyticsLoading";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import { TablePagination } from "@/pages/management/demo/analytics/components/TablePagination";
import { TableSearchBox } from "@/pages/management/demo/analytics/components/TableSearchBox";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/pages/management/demo/analytics/lib/chart-helpers";
import type { ProblemLearner, ProblemType } from "@/types";

type Props = {
  courseId: number;
  inactiveDays: number;
};

type Filter = "ALL" | ProblemType;

const PROBLEM_LABEL: Record<ProblemType, string> = {
  NEVER_STARTED: "Never started",
  DROPPED_OUT: "Dropped out",
  INACTIVE: "Inactive",
  LOW_EXAM_SCORE: "Low exam score",
};

const PROBLEM_VARIANT: Record<ProblemType, "destructive" | "secondary" | "outline"> = {
  DROPPED_OUT: "destructive",
  NEVER_STARTED: "secondary",
  INACTIVE: "secondary",
  LOW_EXAM_SCORE: "outline",
};

/** Learners having trouble with the course + Duolingo-style reminders. */
export function ProblemLearnersPanel({ courseId, inactiveDays }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const queryKey = ["course-analytics", "problem-learners", courseId, inactiveDays];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    placeholderData: keepPreviousData,
    queryFn: () => courseAnalyticsApi.getProblemLearners(courseId, { inactiveDays }),
  });

  const nudge = useMutation({
    mutationFn: (userIds: number[]) =>
      courseAnalyticsApi.sendNudges(courseId, { userIds, inactiveDays }),
    onSuccess: (result) => {
      const parts = [`${result.sent} reminder(s) sent`];
      if (result.skippedCooldown > 0) {
        parts.push(`${result.skippedCooldown} skipped (reminded recently)`);
      }
      if (result.skippedNotEligible > 0) {
        parts.push(`${result.skippedNotEligible} skipped (no longer has a problem)`);
      }
      if (result.sent > 0) {
        toast.success(parts.join(", "));
      } else {
        toast.info(parts.join(", "));
      }
      setSelected(new Set());
      void queryClient.invalidateQueries({
        queryKey: ["course-analytics", "problem-learners", courseId],
      });
    },
    onError: () => toast.error("Could not send the reminders. Please try again."),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.learners ?? []).filter((learner) => {
      if (filter !== "ALL" && !learner.problems.includes(filter)) return false;
      if (!term) return true;
      return [learner.studentName, learner.studentEmail, learner.departmentName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data?.learners, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [filtered, currentPage, pageSize],
  );

  if (isLoading) {
    return <AnalyticsLoading label="Loading learners with problems..." />;
  }
  if (isError || !data) {
    return (
      <AnalyticsEmptyState
        variant="error"
        message="Could not load the list of learners with problems."
      />
    );
  }

  const nudgeable = filtered.filter((learner) => learner.canNudge);
  const selectedNudgeable = nudgeable.filter((learner) => selected.has(learner.userId));
  const allPageSelected =
    paged.filter((learner) => learner.canNudge).length > 0 &&
    paged.filter((learner) => learner.canNudge).every((learner) => selected.has(learner.userId));

  const toggle = (userId: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      paged
        .filter((learner) => learner.canNudge)
        .forEach((learner) => {
          if (checked) next.add(learner.userId);
          else next.delete(learner.userId);
        });
      return next;
    });

  const counts: Record<Filter, number> = {
    ALL: data.totalProblemLearners,
    DROPPED_OUT: data.droppedOutCount,
    NEVER_STARTED: data.neverStartedCount,
    INACTIVE: data.inactiveCount,
    LOW_EXAM_SCORE: data.lowExamScoreCount,
  };
  const filters: Filter[] = ["ALL", "DROPPED_OUT", "NEVER_STARTED", "INACTIVE", "LOW_EXAM_SCORE"];

  return (
    <AnalyticsPanel
      title="Learners with problems"
      description={`Never started, dropped out (inactive 2x the threshold), inactive for ${data.inactiveThresholdDays}+ days, or scoring below 50% in exams. Reminders are in-app notifications; a learner can be reminded once every ${data.cooldownDays} days.`}
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={nudge.isPending || selectedNudgeable.length === 0}
            onClick={() => nudge.mutate(selectedNudgeable.map((learner) => learner.userId))}
          >
            <Bell />
            Remind selected ({selectedNudgeable.length})
          </Button>
          <Button
            size="sm"
            disabled={nudge.isPending || nudgeable.length === 0}
            onClick={() => {
              if (
                window.confirm(
                  `Send a reminder to ${nudgeable.length} learner(s) in the current list?`,
                )
              ) {
                nudge.mutate(nudgeable.map((learner) => learner.userId));
              }
            }}
          >
            <BellRing />
            Remind all ({nudgeable.length})
          </Button>
        </div>
      }
    >
      {!data.totalProblemLearners ? (
        <AnalyticsEmptyState message="No learner has problems with this course. Great work!" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setFilter(item);
                  setPage(0);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  filter === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {item === "ALL" ? "All" : PROBLEM_LABEL[item]} ({formatNumber(counts[item])})
              </button>
            ))}
            <TableSearchBox
              value={search}
              onSearch={(term) => {
                setSearch(term);
                setPage(0);
              }}
              placeholder="Search learner or department..."
            />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={(value) => togglePage(value === true)}
                        aria-label="Select all learners on this page"
                      />
                    </TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Days inactive</TableHead>
                    <TableHead>Stopped at</TableHead>
                    <TableHead>Last reminder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        No learner matches the current filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((learner) => (
                      <ProblemRow
                        key={learner.enrollmentId}
                        learner={learner}
                        checked={selected.has(learner.userId)}
                        onCheckedChange={(checked) => toggle(learner.userId, checked)}
                        onRemind={() => nudge.mutate([learner.userId])}
                        busy={nudge.isPending}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              totalItems={filtered.length}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              unit="learners"
            />
          </div>
        </>
      )}
    </AnalyticsPanel>
  );
}

function ProblemRow({
  learner,
  checked,
  onCheckedChange,
  onRemind,
  busy,
}: {
  learner: ProblemLearner;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onRemind: () => void;
  busy: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={checked}
          disabled={!learner.canNudge}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`Select ${learner.studentName}`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium">{learner.studentName}</div>
        <div className="text-xs text-muted-foreground">
          {learner.studentEmail}
          {learner.departmentName ? ` · ${learner.departmentName}` : ""}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {learner.problems.map((problem) => (
            <Badge key={problem} variant={PROBLEM_VARIANT[problem] ?? "outline"}>
              {PROBLEM_LABEL[problem] ?? problem}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right">{formatPercent(learner.progressPercentage, 0)}</TableCell>
      <TableCell className="text-right font-medium">{learner.inactiveDays} days</TableCell>
      <TableCell className="text-muted-foreground">
        {learner.lastLessonTitle ?? "—"}
        <div className="text-xs">Last visit: {formatDateTime(learner.lastAccessedAt)}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {learner.lastNudgedAt ? (
              <>
                {formatDateTime(learner.lastNudgedAt)}
                <div>{learner.nudgeCount} sent in total</div>
              </>
            ) : (
              "Never reminded"
            )}
          </div>
          <Button
            size="xs"
            variant="outline"
            className="ml-auto"
            disabled={busy || !learner.canNudge}
            onClick={onRemind}
          >
            Remind
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
