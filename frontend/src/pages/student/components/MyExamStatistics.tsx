import { courseApi } from "@/api/features/demo/course.api";
import { examApi, type MyScoreInsights, type PublishedExamScore } from "@/api/features/exam.api";
import { Input } from "@/components/ui/input";
import type { CourseMyScoresDTO } from "@/types/features/course-my-scores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAM_CATEGORY_LABEL, type ExamCategory } from "@/types";
import { formatScore } from "@/utils/examScore";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

/** One published exam result, with the score expressed as a percentage of the exam's max score. */
interface ScorePoint {
  examId: number;
  title: string;
  category: ExamCategory;
  score: number;
  max: number;
  pct: number;
  passPct: number | null;
  passed: boolean | null;
  time: number;
}

const CATEGORY_ORDER: ExamCategory[] = ["QUIZ", "ASSIGNMENT", "MIDTERM", "FINAL_TEST"];

const toPoints = (rows: PublishedExamScore[]): ScorePoint[] =>
  rows
    .filter((row) => row.resultPublished && row.finalScore != null && (row.maxScore ?? 0) > 0)
    .map((row) => {
      const max = row.maxScore as number;
      const score = row.finalScore as number;
      return {
        examId: row.examId,
        title: row.examTitle,
        category: row.category,
        score,
        max,
        pct: Math.max(0, Math.min(100, (score / max) * 100)),
        passPct: row.passScore != null ? (row.passScore / max) * 100 : null,
        passed: row.passed ?? null,
        time: new Date(row.submittedAt).getTime(),
      };
    })
    .sort((a, b) => a.time - b.time);

const shortDate = (time: number) =>
  new Date(time).toLocaleDateString(undefined, { day: "2-digit", month: "short" });

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>}
    </div>
  );
}

/** Line chart of the score percentage of each exam in submission order. */
function TrendChart({ points }: { points: ScorePoint[] }) {
  const W = 560;
  const H = 220;
  const pad = { l: 36, r: 14, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const x = (i: number) => (points.length === 1 ? pad.l + innerW / 2 : pad.l + (innerW * i) / (points.length - 1));
  const y = (pct: number) => pad.t + innerH * (1 - pct / 100);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Score percentage of each exam over time"
      className="h-auto w-full"
    >
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeDasharray={tick === 0 ? undefined : "3 4"}
          />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {tick}%
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={path} fill="none" className="stroke-sky-500" strokeWidth={2} />}
      {points.map((p, i) => (
        <circle
          key={`${p.examId}-${p.time}`}
          cx={x(i)}
          cy={y(p.pct)}
          r={4.5}
          className={p.passed === false ? "fill-rose-500" : p.passed === true ? "fill-emerald-500" : "fill-sky-500"}
        >
          <title>{`${p.title}: ${formatScore(p.score)}/${formatScore(p.max)} (${p.pct.toFixed(0)}%)`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 8} className="fill-muted-foreground text-[10px]">
        {shortDate(points[0].time)}
      </text>
      {points.length > 1 && (
        <text x={W - pad.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {shortDate(points[points.length - 1].time)}
        </text>
      )}
    </svg>
  );
}

/** Horizontal bars: average percentage per exam category. */
function CategoryBars({ points }: { points: ScorePoint[] }) {
  const rows = CATEGORY_ORDER.map((category) => {
    const items = points.filter((p) => p.category === category);
    return {
      category,
      count: items.length,
      avg: items.length ? items.reduce((sum, p) => sum + p.pct, 0) / items.length : 0,
    };
  }).filter((row) => row.count > 0);

  return (
    <ul className="space-y-3" aria-label="Average score by exam category">
      {rows.map((row) => (
        <li key={row.category}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">{EXAM_CATEGORY_LABEL[row.category]}</span>
            <span className="text-muted-foreground">
              {row.avg.toFixed(0)}% · {row.count} exam{row.count > 1 ? "s" : ""}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${row.avg}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Donut: share of exams passed vs not passed (only exams that have a pass score). */
function PassDonut({ passed, failed }: { passed: number; failed: number }) {
  const total = passed + failed;
  const r = 40;
  const c = 2 * Math.PI * r;
  const passLen = total === 0 ? 0 : (passed / total) * c;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${passed} passed, ${failed} not passed`} className="size-32 shrink-0">
        <circle cx={50} cy={50} r={r} fill="none" strokeWidth={14} className="stroke-rose-500" />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          strokeWidth={14}
          className="stroke-emerald-500"
          strokeDasharray={`${passLen} ${c - passLen}`}
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={55} textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
          {total === 0 ? "-" : `${Math.round((passed / total) * 100)}%`}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-emerald-500" /> Passed <strong>{passed}</strong>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-rose-500" /> Not passed <strong>{failed}</strong>
        </li>
      </ul>
    </div>
  );
}

/** One bar per exam with a marker at the pass score. */
function ExamBars({ points }: { points: ScorePoint[] }) {
  const latest = [...points].reverse().slice(0, 8);
  return (
    <ul className="space-y-3" aria-label="Score of each exam compared with its pass score">
      {latest.map((p) => (
        <li key={`${p.examId}-${p.time}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium" title={p.title}>{p.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatScore(p.score)}/{formatScore(p.max)}
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${p.passed === false ? "bg-rose-500" : p.passed === true ? "bg-emerald-500" : "bg-sky-500"}`}
              style={{ width: `${p.pct}%` }}
            />
            {p.passPct != null && (
              <span
                className="absolute -top-1 h-4.5 w-0.5 bg-foreground/70"
                style={{ left: `${Math.min(100, p.passPct)}%` }}
                title={`Pass score: ${p.passPct.toFixed(0)}%`}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  ESSAY: "Essay",
  CODING: "Coding",
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} min ${s.toString().padStart(2, "0")} s` : `${s} s`;
};

/* ------------------------------------------------------------------ */
/* Date range filter (by enrollment date)                              */
/* ------------------------------------------------------------------ */

export interface DateRange {
  from: string;
  to: string;
}

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

const rangeError = (range: DateRange) =>
  range.from && range.to && range.to < range.from ? "The end date must not be before the start date." : null;

/** A range with an invalid order is not applied; the warning tells the user why. */
export const effectiveRange = (range: DateRange): DateRange => (rangeError(range) ? EMPTY_RANGE : range);

const isRangeActive = (range: DateRange) => Boolean(range.from || range.to);

export const inRange = (isoDate: string | null, range: DateRange) => {
  if (!range.from && !range.to) return true;
  if (!isoDate) return false;
  const day = isoDate.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
};

export function DateRangeFilter({
  value,
  onChange,
  idPrefix,
  label = "Enrollment date",
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  idPrefix: string;
  label?: string;
}) {
  const error = rangeError(value);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-from`} className="text-xs font-medium text-muted-foreground">
            {label}: from
          </label>
          <Input
            id={`${idPrefix}-from`}
            type="date"
            className="w-44"
            value={value.from}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-to`} className="text-xs font-medium text-muted-foreground">
            to
          </label>
          <Input
            id={`${idPrefix}-to`}
            type="date"
            className="w-44"
            value={value.to}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
        {isRangeActive(value) && (
          <button
            type="button"
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
            onClick={() => onChange(EMPTY_RANGE)}
          >
            Clear dates
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error} The date filter is not applied until this is fixed.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Course rows (enrollment + progress + grades)                        */
/* ------------------------------------------------------------------ */

type CompletionFilter = "ALL" | "COMPLETED" | "INCOMPLETE";

interface CourseRow {
  id: number;
  name: string;
  enrolledAt: string | null;
  progress: number | null;
  allScored: boolean;
  completed: boolean;
  overall: number | null;
  status: "PASSED" | "FAILED" | null;
  examIds: number[];
  items: CourseMyScoresDTO["gradeItems"];
}

const buildCourseRows = (courses: MyScoreInsights["courses"], scores: CourseMyScoresDTO[]): CourseRow[] => {
  const scoreByCourse = new Map(scores.map((s) => [s.courseId, s]));
  return courses.map((course) => {
    const score = scoreByCourse.get(course.courseId);
    const items = score?.gradeItems ?? [];
    const progress = course.lessonsTotal > 0 ? (course.lessonsCompleted / course.lessonsTotal) * 100 : null;
    // Every grade item that is backed by an exam must have a released score.
    const allScored = items.filter((i) => i.examId != null).every((i) => i.value != null);
    return {
      id: course.courseId,
      name: course.courseName,
      enrolledAt: course.enrolledAt,
      progress,
      allScored,
      completed: progress != null && progress >= 100 && allScored,
      overall: score?.overallScore ?? null,
      status: score?.resultStatus ?? null,
      examIds: course.examIds,
      items,
    };
  });
};

const GRADE_CATEGORIES = ["Assignment", "Midterm", "Final", "Quiz"] as const;

function CompletionBadge({ completed }: { completed: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        completed
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {completed ? "Completed" : "In progress"}
    </span>
  );
}

const formatDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/* ------------------------------------------------------------------ */
/* Exam statistics for a set of exams (all exams or one course)        */
/* ------------------------------------------------------------------ */

function ExamStatsView({
  allPoints,
  data,
  examIds,
  emptyText,
}: {
  allPoints: ScorePoint[];
  data: MyScoreInsights | undefined;
  /** null = no restriction (all exams the student has taken). */
  examIds: Set<number> | null;
  emptyText: string;
}) {
  const points = useMemo(
    () => (examIds ? allPoints.filter((p) => examIds.has(p.examId)) : allPoints),
    [allPoints, examIds],
  );
  const keep = (id: number) => (examIds ? examIds.has(id) : true);

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const avg = points.reduce((sum, p) => sum + p.pct, 0) / points.length;
    const best = points.reduce((a, b) => (b.pct > a.pct ? b : a));
    const latest = points[points.length - 1];
    const passed = points.filter((p) => p.passed === true).length;
    const failed = points.filter((p) => p.passed === false).length;
    return { avg, best, latest, passed, failed };
  }, [points]);

  const awaiting = (data?.awaitingExamIds ?? []).filter(keep).length;
  const appeals = (data?.pendingAppealExamIds ?? []).filter(keep).length;

  const averageByExam = new Map((data?.classAverages ?? []).map((c) => [c.examId, c]));
  const compare = points.filter((p) => averageByExam.has(p.examId)).slice(-8).reverse();

  const attemptsByExam = new Map<number, MyScoreInsights["attempts"]>();
  (data?.attempts ?? []).filter((a) => keep(a.examId)).forEach((a) =>
    attemptsByExam.set(a.examId, [...(attemptsByExam.get(a.examId) ?? []), a]),
  );
  const multi = [...attemptsByExam.values()]
    .filter((list) => list.length > 1)
    .map((list) => [...list].sort((a, b) => a.attemptNumber - b.attemptNumber))
    .slice(0, 6);

  const timed = (data?.attempts ?? [])
    .filter((a) => keep(a.examId) && a.startedAt && a.durationMinutes > 0)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 8);

  const accuracy = useMemo(() => {
    const byType = new Map<string, { questions: number; earned: number; possible: number }>();
    (data?.accuracyByExamType ?? []).filter((t) => keep(t.examId)).forEach((t) => {
      const cur = byType.get(t.type) ?? { questions: 0, earned: 0, possible: 0 };
      byType.set(t.type, {
        questions: cur.questions + t.questionCount,
        earned: cur.earned + t.earned,
        possible: cur.possible + t.possible,
      });
    });
    return [...byType.entries()]
      .filter(([, v]) => v.possible > 0)
      .map(([type, v]) => ({ type, questions: v.questions, percent: (v.earned * 100) / v.possible }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, examIds]);

  const hasPending = awaiting > 0 || appeals > 0;

  if (!summary && !hasPending) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Exams taken" value={String(points.length)} />
          <StatTile label="Average score" value={`${summary.avg.toFixed(0)}%`} />
          <StatTile label="Best result" value={`${summary.best.pct.toFixed(0)}%`} detail={summary.best.title} />
          <StatTile label="Latest result" value={`${summary.latest.pct.toFixed(0)}%`} detail={summary.latest.title} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Awaiting publication" value={String(awaiting)} detail="Submitted exams without released results" />
        <StatTile label="Pending appeals" value={String(appeals)} detail="Waiting for a teacher's decision" />
      </div>

      {summary && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score trend</CardTitle>
              <CardDescription>Score of each exam as a percentage, in submission order.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart points={points} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average by exam type</CardTitle>
              <CardDescription>Quiz, assignment, midterm and final test compared.</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBars points={points} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exams vs pass score</CardTitle>
              <CardDescription>The marker shows each exam's pass score.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExamBars points={points} />
            </CardContent>
          </Card>

          {summary.passed + summary.failed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Passed vs not passed</CardTitle>
                <CardDescription>Only exams that define a pass score are counted.</CardDescription>
              </CardHeader>
              <CardContent>
                <PassDonut passed={summary.passed} failed={summary.failed} />
              </CardContent>
            </Card>
          )}

          {compare.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">You vs class average</CardTitle>
                <CardDescription>
                  Your best score per exam; the marker is the class average (shown when at least 3 students took the exam).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3" aria-label="Your score compared with the class average">
                  {compare.map((p) => {
                    const avg = averageByExam.get(p.examId)!;
                    return (
                      <li key={`${p.examId}-${p.time}`}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium" title={p.title}>{p.title}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {p.pct.toFixed(0)}% vs {avg.averagePercent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${p.pct}%` }} />
                          <span
                            className="absolute -top-1 h-4.5 w-0.5 bg-foreground/70"
                            style={{ left: `${Math.min(100, avg.averagePercent)}%` }}
                            title={`Class average: ${avg.averagePercent.toFixed(0)}% (${avg.participants} students)`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {multi.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score by attempt</CardTitle>
                <CardDescription>How your score changed across attempts of the same exam.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {multi.map((list) => (
                  <div key={list[0].examId}>
                    <p className="mb-1 truncate text-sm font-medium" title={list[0].examTitle}>{list[0].examTitle}</p>
                    <ul className="space-y-1.5">
                      {list.map((a) => {
                        const pct = Math.max(0, Math.min(100, (a.finalScore / a.maxScore) * 100));
                        return (
                          <li key={a.attemptNumber} className="flex items-center gap-2 text-xs">
                            <span className="w-16 shrink-0 text-muted-foreground">Attempt {a.attemptNumber}</span>
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full ${a.passed === false ? "bg-rose-500" : a.passed === true ? "bg-emerald-500" : "bg-sky-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-14 shrink-0 text-right">{formatScore(a.finalScore)}/{formatScore(a.maxScore)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {timed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Time used vs allowed time</CardTitle>
                <CardDescription>Time you spent on your most recent attempts compared with the exam duration.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3" aria-label="Time spent compared with the exam duration">
                  {timed.map((a) => {
                    const pct = Math.min(100, (a.timeSpentSeconds / (a.durationMinutes * 60)) * 100);
                    return (
                      <li key={`${a.examId}-${a.attemptNumber}`}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium" title={a.examTitle}>
                            {a.examTitle} · #{a.attemptNumber}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatDuration(a.timeSpentSeconds)} / {a.durationMinutes} min
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted">
                          <div className={`h-full rounded-full ${pct >= 95 ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {accuracy.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accuracy by question type</CardTitle>
                <CardDescription>Points earned out of points available, across your published results.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3" aria-label="Accuracy by question type">
                  {accuracy.map((t) => (
                    <li key={t.type}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                        <span className="text-muted-foreground">
                          {t.percent.toFixed(0)}% · {t.questions} questions
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, t.percent)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aggregate > By course                                               */
/* ------------------------------------------------------------------ */

function CourseOverview({ rows }: { rows: CourseRow[] }) {
  const scored = rows.filter((r) => r.overall != null);
  const avg = scored.length ? scored.reduce((s, r) => s + (r.overall as number), 0) / scored.length : null;
  const completedCount = rows.filter((r) => r.completed).length;
  const passedCount = rows.filter((r) => r.status === "PASSED").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Courses" value={String(rows.length)} />
        <StatTile label="Completed" value={String(completedCount)} detail="All lessons done and every exam scored" />
        <StatTile label="Average overall score" value={avg != null ? `${avg.toFixed(1)}/10` : "—"} />
        <StatTile label="Courses passed" value={String(passedCount)} detail="Overall score of 5 or more" />
      </div>

      {scored.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall score by course</CardTitle>
            <CardDescription>Weighted overall score out of 10; the marker is the pass mark (5).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" aria-label="Overall score of each course">
              {scored.map((r) => (
                <li key={r.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium" title={r.name}>{r.name}</span>
                    <span className="shrink-0 text-muted-foreground">{(r.overall as number).toFixed(1)}/10</span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${r.status === "FAILED" ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(0, Math.min(100, (r.overall as number) * 10))}%` }}
                    />
                    <span className="absolute -top-1 h-4.5 w-0.5 bg-foreground/70" style={{ left: "50%" }} title="Pass mark: 5" />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Courses</CardTitle>
          <CardDescription>Enrollment date, lesson progress and result of each course.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Course</th>
                <th className="py-2 pr-3 font-medium">Enrolled</th>
                <th className="py-2 pr-3 font-medium">Progress</th>
                <th className="py-2 pr-3 font-medium">Overall</th>
                <th className="py-2 pr-3 font-medium">Result</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="max-w-64 truncate py-2 pr-3 font-medium" title={r.name}>{r.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatDay(r.enrolledAt)}</td>
                  <td className="py-2 pr-3">{r.progress != null ? `${r.progress.toFixed(0)}%` : "—"}</td>
                  <td className="py-2 pr-3">{r.overall != null ? r.overall.toFixed(1) : "—"}</td>
                  <td className="py-2 pr-3">{r.status ?? "—"}</td>
                  <td className="py-2"><CompletionBadge completed={r.completed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Statistics by course (tags + search + date filter)                  */
/* ------------------------------------------------------------------ */

function CourseDetail({
  row,
  allPoints,
  data,
}: {
  row: CourseRow;
  allPoints: ScorePoint[];
  data: MyScoreInsights | undefined;
}) {
  const examIds = useMemo(() => new Set(row.examIds), [row.examIds]);
  const categories = GRADE_CATEGORIES.map((category) => {
    const values = row.items
      .filter((i) => i.gradeCategory === category && i.value != null)
      .map((i) => i.value as number);
    return { category, avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null, count: values.length };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Overall score" value={row.overall != null ? `${row.overall.toFixed(1)}/10` : "—"} detail={row.name} />
        <StatTile label="Result" value={row.status ?? "—"} />
        <StatTile label="Lesson progress" value={row.progress != null ? `${row.progress.toFixed(0)}%` : "—"} />
        <StatTile label="Status" value={row.completed ? "Completed" : "In progress"} detail={`Enrolled ${formatDay(row.enrolledAt)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score by grade group</CardTitle>
          <CardDescription>Average score (out of 10) of the released exams in each group.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3" aria-label="Score by grade group">
            {categories.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{c.category}</span>
                  <span className="text-muted-foreground">
                    {c.avg != null ? `${c.avg.toFixed(1)}/10 · ${c.count} exam${c.count === 1 ? "" : "s"}` : "No score yet"}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-muted">
                  {c.avg != null && (
                    <div
                      className={`h-full rounded-full ${c.avg < 5 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(0, Math.min(100, c.avg * 10))}%` }}
                    />
                  )}
                  <span className="absolute -top-1 h-4.5 w-0.5 bg-foreground/70" style={{ left: "50%" }} title="Pass mark: 5" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold">Exam statistics of this course</h3>
      <ExamStatsView
        allPoints={allPoints}
        data={data}
        examIds={examIds}
        emptyText="No published exam results for this course yet."
      />
    </div>
  );
}

function StatsByCourse({
  rows,
  allPoints,
  data,
}: {
  rows: CourseRow[];
  allPoints: ScorePoint[];
  data: MyScoreInsights | undefined;
}) {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const applied = effectiveRange(range);
  const visible = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.trim().toLowerCase()) && inRange(r.enrolledAt, applied),
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const selectedVisible = selected && visible.some((r) => r.id === selected.id) ? selected : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor="course-search" className="text-xs font-medium text-muted-foreground">
            Search course
          </label>
          <Input
            id="course-search"
            className="w-64"
            placeholder="Course name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DateRangeFilter value={range} onChange={setRange} idPrefix="course-filter" />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No course matches the current search or date filter.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list" aria-label="Courses">
          {visible.map((r) => {
            const active = selectedVisible?.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="listitem"
                aria-pressed={active}
                onClick={() => setSelectedId(active ? null : r.id)}
                className={`flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "border-primary ring-2 ring-primary/40" : ""
                }`}
              >
                <span className="line-clamp-2 break-words text-sm font-semibold leading-snug">{r.name}</span>
                <span className="text-xs text-muted-foreground">Enrolled {formatDay(r.enrolledAt)}</span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <CompletionBadge completed={r.completed} />
                  <span className="text-xs text-muted-foreground">
                    {r.overall != null ? `${r.overall.toFixed(1)}/10` : "No score"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedVisible ? (
        <CourseDetail row={selectedVisible} allPoints={allPoints} data={data} />
      ) : (
        visible.length > 0 && (
          <p className="text-sm text-muted-foreground">Select a course to see its statistics.</p>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page section                                                        */
/* ------------------------------------------------------------------ */

function CompletionRadios({ value, onChange }: { value: CompletionFilter; onChange: (v: CompletionFilter) => void }) {
  const options: { value: CompletionFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "COMPLETED", label: "Completed" },
    { value: "INCOMPLETE", label: "Not completed" },
  ];
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-muted-foreground">Course status</legend>
      <div className="flex h-9 items-center gap-4">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="completion-filter"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type StatsSection = "all-course" | "course" | "exam";

const SECTIONS: { value: StatsSection; label: string }[] = [
  { value: "all-course", label: "All course" },
  { value: "course", label: "Course" },
  { value: "exam", label: "Exam" },
];

/** Score statistics of the student's published exam results, drawn with plain SVG/CSS. */
export function MyExamStatistics() {
  const scoresQuery = useQuery({
    queryKey: ["my-published-exam-scores-stats"],
    queryFn: () => examApi.getMyPublishedExamScores(),
  });
  const insightsQuery = useQuery({
    queryKey: ["my-score-insights"],
    queryFn: () => examApi.getMyScoreInsights(),
  });
  const courseScoresQuery = useQuery({
    queryKey: ["my-course-scores"],
    queryFn: courseApi.getMyScores,
  });

  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [completion, setCompletion] = useState<CompletionFilter>("ALL");
  const [section, setSection] = useState<StatsSection>("all-course");

  const allPoints = useMemo(() => toPoints(scoresQuery.data ?? []), [scoresQuery.data]);
  const data = insightsQuery.data;
  const rows = useMemo(
    () => buildCourseRows(data?.courses ?? [], courseScoresQuery.data ?? []),
    [data, courseScoresQuery.data],
  );

  const applied = effectiveRange(range);
  const rangeRows = rows.filter((r) => inRange(r.enrolledAt, applied));
  const courseTabRows = rangeRows.filter(
    (r) => completion === "ALL" || (completion === "COMPLETED" ? r.completed : !r.completed),
  );

  // "By exam" only uses the date filter. Exams of a course follow the course's enrollment date;
  // exams that belong to no course have no enrollment date, so they are hidden while a date filter is active.
  const examIdsByDate = useMemo(() => {
    if (!isRangeActive(applied)) return null;
    return new Set(rangeRows.flatMap((r) => r.examIds));
  }, [applied, rangeRows]);

  const loading = scoresQuery.isLoading || insightsQuery.isLoading || courseScoresQuery.isLoading;
  const failed = scoresQuery.isError || insightsQuery.isError;

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-muted-foreground">Loading statistics...</p>}
      {failed && <p className="text-sm text-destructive">Unable to load statistics.</p>}

      {!loading && !failed && (
        <div className="flex flex-col gap-6 md:flex-row">
          <nav aria-label="Statistics sections" className="flex shrink-0 gap-1 md:w-44 md:flex-col">
            {SECTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-current={section === s.value ? "page" : undefined}
                onClick={() => setSection(s.value)}
                className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  section === s.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 space-y-4">
          {section === "all-course" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-6">
              <DateRangeFilter value={range} onChange={setRange} idPrefix="aggregate-course" />
              <CompletionRadios value={completion} onChange={setCompletion} />
            </div>
            {courseTabRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course matches the current filters.</p>
            ) : (
              <CourseOverview rows={courseTabRows} />
            )}
          </div>
          )}

          {section === "course" && (
          <div className="space-y-4">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are not enrolled in any course yet.</p>
            ) : (
              <StatsByCourse rows={rows} allPoints={allPoints} data={data} />
            )}
          </div>
          )}

          {section === "exam" && (
          <div className="space-y-4">
            <DateRangeFilter value={range} onChange={setRange} idPrefix="aggregate-exam" />
            {isRangeActive(applied) && (
              <p className="text-xs text-muted-foreground">
                Only exams of courses enrolled in this period are shown; exams outside any course are hidden while a date filter is on.
              </p>
            )}
            <ExamStatsView
              allPoints={allPoints}
              data={data}
              examIds={examIdsByDate}
              emptyText="No published exam results yet. Your statistics will appear here once a teacher releases your scores."
            />
          </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
