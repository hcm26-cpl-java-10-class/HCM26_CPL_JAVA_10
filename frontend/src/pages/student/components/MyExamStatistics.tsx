import { examApi, type MyScoreInsights, type PublishedExamScore } from "@/api/features/exam.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAM_CATEGORY_LABEL, type ExamCategory } from "@/types";
import { formatScore } from "@/utils/examScore";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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

/** Extra statistics: class comparison, attempts, pending items, time used and accuracy by question type. */
function InsightsSection({ points }: { points: ScorePoint[] }) {
  const query = useQuery({
    queryKey: ["my-score-insights"],
    queryFn: () => examApi.getMyScoreInsights(),
  });
  const data = query.data;
  if (!data) return null;

  const averageByExam = new Map(data.classAverages.map((c) => [c.examId, c]));
  const compare = points.filter((p) => averageByExam.has(p.examId)).slice(-8).reverse();

  const attemptsByExam = new Map<number, MyScoreInsights["attempts"]>();
  data.attempts.forEach((a) => attemptsByExam.set(a.examId, [...(attemptsByExam.get(a.examId) ?? []), a]));
  const multi = [...attemptsByExam.values()]
    .filter((list) => list.length > 1)
    .map((list) => [...list].sort((a, b) => a.attemptNumber - b.attemptNumber))
    .slice(0, 6);

  const timed = [...data.attempts]
    .filter((a) => a.startedAt && a.durationMinutes > 0)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 8);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting publication"
          value={String(data.awaitingPublicationCount)}
          detail="Submitted exams without released results"
        />
        <StatTile label="Pending appeals" value={String(data.pendingAppealCount)} detail="Waiting for a teacher's decision" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

        {data.accuracyByType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accuracy by question type</CardTitle>
              <CardDescription>Points earned out of points available, across your published results.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" aria-label="Accuracy by question type">
                {data.accuracyByType.map((t) => (
                  <li key={t.type}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{TYPE_LABEL[t.type] ?? t.type}</span>
                      <span className="text-muted-foreground">
                        {t.accuracyPercent.toFixed(0)}% · {t.questionCount} questions
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, t.accuracyPercent)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/** Score statistics of the student's published exam results, drawn with plain SVG/CSS. */
export function MyExamStatistics() {
  const query = useQuery({
    queryKey: ["my-published-exam-scores-stats"],
    queryFn: () => examApi.getMyPublishedExamScores(),
  });
  const points = useMemo(() => toPoints(query.data ?? []), [query.data]);

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const avg = points.reduce((sum, p) => sum + p.pct, 0) / points.length;
    const best = points.reduce((a, b) => (b.pct > a.pct ? b : a));
    const latest = points[points.length - 1];
    const passed = points.filter((p) => p.passed === true).length;
    const failed = points.filter((p) => p.passed === false).length;
    return { avg, best, latest, passed, failed };
  }, [points]);

  return (
    <section className="space-y-4" aria-labelledby="exam-statistics-title">
      <h2 id="exam-statistics-title" className="text-xl font-semibold">Exam Statistics</h2>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading exam statistics...</p>}
      {query.isError && <p className="text-sm text-destructive">Unable to load exam statistics.</p>}
      {!query.isLoading && !query.isError && !summary && (
        <p className="text-sm text-muted-foreground">
          No published exam results yet. Your statistics will appear here once a teacher releases your scores.
        </p>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Exams taken" value={String(points.length)} />
            <StatTile label="Average score" value={`${summary.avg.toFixed(0)}%`} />
            <StatTile label="Best result" value={`${summary.best.pct.toFixed(0)}%`} detail={summary.best.title} />
            <StatTile
              label="Latest result"
              value={`${summary.latest.pct.toFixed(0)}%`}
              detail={summary.latest.title}
            />
          </div>

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
          </div>
        </>
      )}

      {!query.isLoading && !query.isError && <InsightsSection points={points} />}
    </section>
  );
}
