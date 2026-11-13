import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { courseAiComparisonApi } from "@/api/features/demo/course-ai-comparison.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsEmptyState } from "@/pages/management/demo/analytics/components/AnalyticsEmptyState";
import { AnalyticsPanel } from "@/pages/management/demo/analytics/components/AnalyticsPanel";
import type {
  AiChatTurn,
  AiComparisonAnalysis,
  AiComparisonLanguage,
  AiModulePosition,
  AiRecommendationPriority,
  CourseComparisonItem,
} from "@/types";

type Props = {
  /** Danh sách khóa học đã load từ GET /api/reports/course-comparison. */
  courses: CourseComparisonItem[];
  /** Khóa học mặc định được chọn làm mục tiêu. */
  defaultTargetId?: number | null;
  /** Số khóa học tối đa gửi cho AI (backend cũng giới hạn lại). */
  maxPeers?: number;
};

const POSITION_STYLES: Record<AiModulePosition, { label: string; className: string }> = {
  ABOVE: {
    label: "Above peers",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  AT_PAR: {
    label: "On par",
    className: "bg-muted text-muted-foreground",
  },
  BELOW: {
    label: "Below peers",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

const PRIORITY_STYLES: Record<AiRecommendationPriority, { label: string; className: string }> = {
  HIGH: {
    label: "High",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  LOW: {
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
};

const VERDICT_STYLES: Record<string, { label: string; className: string }> = {
  STRONGER: {
    label: "Stronger than peers",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  SIMILAR: {
    label: "Similar to peers",
    className: "bg-muted text-muted-foreground",
  },
  WEAKER: {
    label: "Weaker than peers",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

/**
 * Panel phân tích so sánh bằng AI.
 *
 * <p>Backend tính toàn bộ số liệu (rank, median, percentile, gap) rồi đưa cho AI
 * diễn giải. Ở đây người dùng chỉ chọn khóa mục tiêu + các khóa đối chiếu, có
 * thêm một câu hỏi trọng tâm, rồi đọc kết quả.
 */
/** Các hướng phân tích có sẵn. `value` khớp với CourseAiFocusPreset ở backend. */
const FOCUS_ALL = "all";
const FOCUS_OPTIONS: { value: string; label: string }[] = [
  { value: FOCUS_ALL, label: "All modules (default)" },
  { value: "completion", label: "Completion & drop-off" },
  { value: "trend", label: "Enrollment & progress trend" },
  { value: "activity", label: "Learner activity & engagement" },
  { value: "rating", label: "Ratings & reviews" },
  { value: "departments", label: "Department differences" },
  { value: "ranking", label: "Ranking among peers" },
  { value: "content", label: "Learning content" },
  { value: "study-time", label: "Study time" },
];

export function CourseAiComparisonPanel({
  courses,
  defaultTargetId,
  maxPeers = 15,
}: Props) {
  const [targetId, setTargetId] = useState<number | null>(
    defaultTargetId ?? courses[0]?.courseId ?? null,
  );
  const [peerIds, setPeerIds] = useState<number[]>([]);
  const [focus, setFocus] = useState<string>(FOCUS_ALL);
  const [language, setLanguage] = useState<AiComparisonLanguage>("en");

  const peerCandidates = useMemo(
    () => courses.filter((course) => course.courseId !== targetId),
    [courses, targetId],
  );

  const analyze = useMutation({
    mutationFn: () =>
      courseAiComparisonApi.analyze({
        targetCourseId: targetId!,
        peerCourseIds: peerIds.length ? peerIds : undefined,
        focus: focus === FOCUS_ALL ? undefined : focus,
        language,
      }),
    onSuccess: (data) => {
      toast.success(
        `AI analysed ${data.targetCourseName} against ${data.peerCount} peer course(s).`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "The AI analysis failed. Please try again.");
    },
  });

  const togglePeer = (id: number) => {
    setPeerIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= maxPeers) {
        toast.error(`You can compare against at most ${maxPeers} peer courses.`);
        return current;
      }
      return [...current, id];
    });
  };

  const canAnalyze = targetId != null && !analyze.isPending;

  return (
    <div className="space-y-4">
      {/* ---------- Bộ chọn ---------- */}
      <AnalyticsPanel
        title="AI comparison"
        description="Pick one target course, the peer courses to compare against, and let AI explain the difference."
        action={
          <Button
            type="button"
            onClick={() => analyze.mutate()}
            disabled={!canAnalyze}
            size="sm"
          >
            {analyze.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {analyze.isPending ? "Analysing..." : "Analyse with AI"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-target-course">Target course</Label>
              <Select
                value={targetId == null ? undefined : String(targetId)}
                onValueChange={(next) => {
                  const id = Number(next);
                  setTargetId(id);
                  setPeerIds((current) => current.filter((value) => value !== id));
                }}
              >
                <SelectTrigger id="ai-target-course" className="w-full">
                  <SelectValue placeholder="Select the course to analyse" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem
                      key={course.courseId}
                      value={String(course.courseId)}
                    >
                      {course.courseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-focus">Focus (optional)</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger id="ai-focus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick a topic for the AI to focus on, or keep the default to analyse all 8 modules.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-language">Answer language</Label>
            <Select
              value={language}
              onValueChange={(next) => setLanguage(next as AiComparisonLanguage)}
            >
              <SelectTrigger id="ai-language" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Peer courses ({peerIds.length}/{maxPeers})</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setPeerIds(
                      peerCandidates
                        .slice(0, maxPeers)
                        .map((course) => course.courseId),
                    )
                  }
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setPeerIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to let the backend pick the most relevant peers
              automatically.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {peerCandidates.map((course) => {
                const checked = peerIds.includes(course.courseId);
                return (
                  <label
                    key={course.courseId}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePeer(course.courseId)}
                      className="mt-0.5"
                      aria-label={course.courseName}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {course.courseName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {course.instructor || "No instructor"} ·{" "}
                        {course.overallScore.toFixed(1)} pts
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </AnalyticsPanel>

      {/* ---------- Kết quả ---------- */}
      {analyze.isError ? (
        <AnalyticsEmptyState
          variant="error"
          message={
            analyze.error instanceof Error
              ? analyze.error.message
              : "The AI analysis failed. Please try again."
          }
        />
      ) : null}

      {analyze.data ? (
        <AiAnalysisResult
          analysis={analyze.data.analysis}
          peersAutoSelected={analyze.data.peersAutoSelected}
          peersTruncated={analyze.data.peersTruncated}
          targetCourseId={analyze.data.targetCourseId}
          peerCourseIds={analyze.data.peerCourseIds}
          language={language}
        />
      ) : null}
    </div>
  );
}

/** ======================================================================
 *  Kết quả phân tích
 *  ====================================================================== */

function AiAnalysisResult({
  analysis,
  peersAutoSelected,
  peersTruncated,
  targetCourseId,
  peerCourseIds,
  language,
}: {
  analysis: AiComparisonAnalysis;
  peersAutoSelected: boolean;
  peersTruncated: boolean;
  targetCourseId: number;
  peerCourseIds: number[];
  language: AiComparisonLanguage;
}) {
  const verdict = VERDICT_STYLES[analysis.overall.verdict];

  return (
    <div className="space-y-3">
      <AnalyticsPanel
        title="AI verdict"
        description="The numbers are computed by the backend; AI only explains them."
        action={
          verdict ? (
            <Badge className={verdict.className}>{verdict.label}</Badge>
          ) : null
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Bot className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{analysis.headline}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {analysis.overall.summary}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5" />
              Rank #{analysis.overall.rank} / {analysis.overall.outOf}
            </span>
            {peersAutoSelected ? (
              <span className="inline-flex items-center gap-1">
                <Bot className="size-3.5" />
                Peer courses were picked automatically
              </span>
            ) : null}
            {peersTruncated ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-3.5" />
                Only the first {15} peer courses were sent to the AI
              </span>
            ) : null}
          </div>
        </div>
      </AnalyticsPanel>

      {/* ---------- Modules ---------- */}
      <AnalyticsPanel
        title="Position by module"
        description="Every analytics module, with the evidence behind the position."
      >
        <div className="space-y-2">
          {analysis.modules.map((module) => {
            const style = POSITION_STYLES[module.position] ?? POSITION_STYLES.AT_PAR;
            return (
              <div
                key={module.moduleKey}
                className="rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {module.moduleKey}
                  </span>
                  <Badge className={style.className}>{style.label}</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {module.finding}
                </p>
                {module.evidence.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {module.evidence.map((evidence, index) => (
                      <span
                        key={`${module.moduleKey}-${evidence.metric}-${index}`}
                        className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {evidence.metric}
                        </span>
                        : {formatValue(evidence.target)} vs peer median{" "}
                        {formatValue(evidence.peerMedian)}
                        {evidence.bestPeer
                          ? ` · best: ${evidence.bestPeer}`
                          : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </AnalyticsPanel>

      {/* ---------- Strengths / weaknesses ---------- */}
      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsPanel
          title="Strengths"
          description="What the target course does better than its peers."
        >
          <ListBlock
            items={analysis.strengths}
            empty="No clear strength was identified."
            tone="good"
          />
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Weaknesses"
          description="Where the target course lags behind its peers."
        >
          <ListBlock
            items={analysis.weaknesses}
            empty="No clear weakness was identified."
            tone="bad"
          />
        </AnalyticsPanel>
      </div>

      {/* ---------- Biggest gaps ---------- */}
      {analysis.biggestGaps.length ? (
        <AnalyticsPanel
          title="Biggest gaps"
          description="The largest negative differences against the peer median, computed by the backend."
        >
          <div className="space-y-1.5">
            {analysis.biggestGaps.map((gap, index) => (
              <div
                key={`${gap.metric}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{gap.metric}</span>
                <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  <span>{gap.moduleKey}</span>
                  <span>
                    {formatValue(gap.target)} vs {formatValue(gap.peerMedian)}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-red-600 dark:text-red-400">
                    <ArrowDownRight className="size-3.5" />
                    {formatValue(Math.abs(gap.gap ?? 0))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </AnalyticsPanel>
      ) : null}

      {/* ---------- Benchmark peers ---------- */}
      {analysis.benchmarkPeers.length ? (
        <AnalyticsPanel
          title="Courses worth studying"
          description="Peers that perform best where the target is weakest."
        >
          <div className="space-y-2">
            {analysis.benchmarkPeers.map((peer) => (
              <div
                key={peer.courseId}
                className="rounded-lg border bg-card px-3 py-2.5 text-sm shadow-sm"
              >
                <div className="font-medium">{peer.courseName}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {peer.why}
                </p>
              </div>
            ))}
          </div>
        </AnalyticsPanel>
      ) : null}

      {/* ---------- Recommendations ---------- */}
      {analysis.recommendations.length ? (
        <AnalyticsPanel
          title="Recommended actions"
          description="Ordered by expected impact. Every action links back to a number in the comparison."
        >
          <div className="space-y-2">
            {analysis.recommendations.map((rec, index) => {
              const style = PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.MEDIUM;
              return (
                <div
                  key={`${rec.moduleKey}-${index}`}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{rec.action}</span>
                    <Badge className={style.className}>{style.label}</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Module:</span>{" "}
                      {rec.moduleKey}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Based on:</span>{" "}
                      {rec.basedOn}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Expected impact:
                      </span>{" "}
                      {rec.expectedImpact}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>
      ) : null}

      {/* ---------- Caveats ---------- */}
      {analysis.dataCaveats.length ? (
        <AnalyticsPanel
          title="Data caveats"
          description="Limitations you should keep in mind when reading the analysis."
        >
          <ul className="space-y-1.5">
            {analysis.dataCaveats.map((caveat, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>{caveat}</span>
              </li>
            ))}
          </ul>
        </AnalyticsPanel>
      ) : null}

      {/* ---------- Hỏi đáp tiếp ---------- */}
      <AiFollowUpChat
        targetCourseId={targetCourseId}
        peerCourseIds={peerCourseIds}
        language={language}
      />
    </div>
  );
}

/** ======================================================================
 *  Hỏi đáp tiếp về kết quả so sánh (multi-turn)
 *  ====================================================================== */

function AiFollowUpChat({
  targetCourseId,
  peerCourseIds,
  language,
}: {
  targetCourseId: number;
  peerCourseIds: number[];
  language: AiComparisonLanguage;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<AiChatTurn[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const ask = useMutation({
    mutationFn: (asked: string) =>
      courseAiComparisonApi.ask({
        targetCourseId,
        peerCourseIds: peerCourseIds.length ? peerCourseIds : undefined,
        question: asked,
        history: turns,
        language,
      }),
    onSuccess: (answer) => {
      setTurns((current) => [
        ...current,
        { role: "user", content: question },
        { role: "assistant", content: answer.reply },
      ]);
      setSuggestions(answer.followUps);
      setQuestion("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "The AI could not answer that question.");
    },
  });

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  };

  return (
    <AnalyticsPanel
      title="Ask a follow-up"
      description="The AI answers from the same comparison data only — it never invents new statistics."
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <MessageSquarePlus className="size-3.5" />
          Multi-turn
        </span>
      }
    >
      <div className="space-y-3">
        {turns.length ? (
          <div className="space-y-2">
            {turns.map((turn, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 text-sm ${
                  turn.role === "user" ? "justify-end" : ""
                }`}
              >
                {turn.role === "assistant" ? (
                  <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : null}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 leading-relaxed ${
                    turn.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {turn.content}
                </div>
                {turn.role === "user" ? (
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <Input
            value={question}
            maxLength={2000}
            placeholder="e.g. why is the drop-off rate so high?"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(question);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => send(question)}
            disabled={!question.trim() || ask.isPending}
            aria-label="Send question"
          >
            {ask.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
          </Button>
        </div>
      </div>
    </AnalyticsPanel>
  );
}

function ListBlock({
  items,
  empty,
  tone,
}: {
  items: string[];
  empty: string;
  tone: "good" | "bad";
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
        >
          {tone === "good" ? (
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function formatValue(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
