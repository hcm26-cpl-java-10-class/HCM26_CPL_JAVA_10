import { aiInsightApi } from "@/api/features/demo/ai-insight.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import type {
  AiChart,
  AiCourseInsight,
  AiInsightChatMessage,
  AiLessonInsight,
  AiSeverity,
  AiTopicInsight,
} from "@/types/features/demo/ai-insight";
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const SEVERITY_LABEL: Record<AiSeverity, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const SEVERITY_CLASS: Record<AiSeverity, string> = {
  HIGH: "bg-red-100 text-red-700 hover:bg-red-100",
  MEDIUM: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  LOW: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

type SupplementState = {
  lesson: AiLessonInsight;
  topic: AiTopicInsight;
  text: string;
  loading: boolean;
  saving: boolean;
};

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.message ?? error?.response?.data?.error ?? fallback;

function lessonLink(courseId: number, lesson: AiLessonInsight): string {
  const params = new URLSearchParams({
    courseId: String(courseId),
    sectionId: String(lesson.sectionId),
    lessonId: String(lesson.lessonId),
  });
  return `/curriculum?${params.toString()}`;
}

function TopicCard({
  topic,
  canAddExplanation,
  onAddExplanation,
}: {
  topic: AiTopicInsight;
  canAddExplanation: boolean;
  onAddExplanation: () => void;
}) {
  const [showQuestions, setShowQuestions] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{topic.topic}</p>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-0.5">{topic.questionCount} questions</span>
          <span className="rounded-full border px-2 py-0.5">{topic.upvotes} upvotes</span>
          {topic.unansweredCount > 0 && (
            <span className="rounded-full border border-red-200 px-2 py-0.5 text-red-700">
              {topic.unansweredCount} unanswered
            </span>
          )}
        </div>
      </div>

      {topic.misunderstanding && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Students seem to think: </span>
          {topic.misunderstanding}
        </p>
      )}
      {topic.suggestion && (
        <p className="mt-1 text-sm">
          <span className="font-medium">Suggestion: </span>
          {topic.suggestion}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowQuestions((v) => !v)}>
          {showQuestions ? "Hide questions" : `View ${topic.questions.length} questions`}
        </Button>
        {canAddExplanation && (
          <Button variant="outline" size="sm" onClick={onAddExplanation}>
            <Sparkles className="mr-1 h-4 w-4 text-amber-500" /> Add explanation with AI
          </Button>
        )}
      </div>

      {showQuestions && (
        <ul className="mt-2 space-y-1.5">
          {topic.questions.map((question) => (
            <li key={question.id} className="rounded-md border bg-background px-2.5 py-1.5 text-sm">
              <span>{question.content}</span>
              <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                {question.upvotes} upvotes · {question.answered ? "answered" : "unanswered"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LessonCard({
  courseId,
  lesson,
  canUpdateLessons,
  onAddExplanation,
}: {
  courseId: number;
  lesson: AiLessonInsight;
  canUpdateLessons: boolean;
  onAddExplanation: (lesson: AiLessonInsight, topic: AiTopicInsight) => void;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={SEVERITY_CLASS[lesson.severity]}>
              {SEVERITY_LABEL[lesson.severity]}
            </Badge>
            <h3 className="font-semibold">{lesson.lessonTitle}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Section: {lesson.sectionTitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={lessonLink(courseId, lesson)}>
            Open lesson <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {lesson.questionCount} questions · {lesson.upvotes} upvotes · {lesson.unansweredCount} unanswered
      </p>

      <div className="mt-3 space-y-3">
        {lesson.topics.map((topic, index) => (
          <TopicCard
            key={index}
            topic={topic}
            canAddExplanation={canUpdateLessons && lesson.contentType === "TEXT"}
            onAddExplanation={() => onAddExplanation(lesson, topic)}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Charts (plain SVG / CSS, no chart library needed). Numbers and percentages come from the backend.
// ---------------------------------------------------------------------------

const DONUT_COLORS = ["#16a34a", "#dc2626", "#f59e0b", "#3b82f6"];

const BAR_COLORS: Record<string, string> = {
  QUESTIONS_BY_LESSON: "#3b82f6",
  UNANSWERED_BY_LESSON: "#dc2626",
  TOP_TOPICS: "#f59e0b",
};

function DonutChart({ chart }: { chart: AiChart }) {
  const total = chart.items.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={chart.title}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          {total > 0 &&
            chart.items.map((item, index) => {
              const length = (item.value / total) * circumference;
              const circle = (
                <circle
                  key={index}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold">{total}</span>
          <span className="text-[10px] text-muted-foreground">questions</span>
        </div>
      </div>

      <ul className="space-y-2">
        {chart.items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
            />
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">
              {item.value} · {item.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ chart }: { chart: AiChart }) {
  const max = Math.max(...chart.items.map((item) => item.value), 1);
  const color = BAR_COLORS[chart.key] ?? "#3b82f6";

  return (
    <ul className="space-y-3">
      {chart.items.map((item, index) => (
        <li key={index}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-medium">
              {item.value} · {item.percent}%
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({ chart }: { chart: AiChart }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <h4 className="font-semibold">{chart.title}</h4>
      {chart.subtitle && <p className="mb-3 text-xs text-muted-foreground">{chart.subtitle}</p>}
      {chart.type === "DONUT" ? <DonutChart chart={chart} /> : <BarChart chart={chart} />}
    </section>
  );
}

type ChatItem = {
  role: "user" | "assistant";
  text: string;
  charts?: AiChart[];
  report?: AiCourseInsight | null;
  suggestions?: string[];
};

/** Instructor tool: chat with the AI about the questions students asked; answers come with charts and percentages. */
export function StudentQuestionInsights({ courseId }: { courseId: number }) {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [supplement, setSupplement] = useState<SupplementState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canUpdateLessons = hasPermission("LESSON_UPDATE");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading]);

  // First screen: numbers and charts calculated by the system (no AI call).
  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await aiInsightApi.overview(courseId);
      setItems([
        { role: "assistant", text: res.reply, charts: res.charts, report: res.report, suggestions: res.suggestions },
      ]);
      setStarted(true);
    } catch (e: any) {
      toast.error(errorMessage(e, "Could not load the statistics."));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!started && !loading) void loadOverview();
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const next: ChatItem[] = [...items, { role: "user", text: content }];
    setItems(next);
    setInput("");
    setLoading(true);

    const history: AiInsightChatMessage[] = next.slice(-12).map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
    try {
      const res = await aiInsightApi.chat(courseId, history);
      setItems([
        ...next,
        { role: "assistant", text: res.reply, charts: res.charts, report: res.report, suggestions: res.suggestions },
      ]);
    } catch (e: any) {
      toast.error(errorMessage(e, "The AI could not answer. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const generateSupplement = async (lesson: AiLessonInsight, topic: AiTopicInsight) => {
    setSupplement({ lesson, topic, text: "", loading: true, saving: false });
    try {
      const result = await aiInsightApi.supplement(lesson.lessonId, {
        topic: topic.topic,
        misunderstanding: topic.misunderstanding,
        suggestion: topic.suggestion,
        save: false,
      });
      setSupplement((s) => (s ? { ...s, text: result.text, loading: false } : s));
    } catch (e: any) {
      toast.error(errorMessage(e, "Could not write the explanation."));
      setSupplement(null);
    }
  };

  const appendSupplement = async () => {
    if (!supplement || !supplement.text.trim()) return;
    setSupplement({ ...supplement, saving: true });
    try {
      await aiInsightApi.supplement(supplement.lesson.lessonId, {
        topic: supplement.topic.topic,
        save: true,
        text: supplement.text,
      });
      toast.success("Added to the end of the lesson. Open the lesson to review it.");
      setSupplement(null);
    } catch (e: any) {
      toast.error(errorMessage(e, "Could not add the explanation to the lesson."));
      setSupplement((s) => (s ? { ...s, saving: false } : s));
    }
  };

  const lastAssistantIndex = items.map((m) => m.role).lastIndexOf("assistant");

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Ask AI about student questions
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> Ask AI about student questions
            </SheetTitle>
            <SheetDescription>
              Ask in English or Vietnamese. Numbers and percentages are calculated by the system, and student names are
              never sent to the AI.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {items.map((item, index) => (
              <div key={index} className={item.role === "user" ? "flex justify-end" : "space-y-3"}>
                {item.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {item.text}
                  </div>
                ) : (
                  <>
                    <div className="max-w-[92%] whitespace-pre-line rounded-2xl bg-muted px-3 py-2 text-sm">
                      {item.text}
                    </div>

                    {item.charts?.map((chart) => (
                      <ChartCard key={chart.key} chart={chart} />
                    ))}

                    {item.report && (
                      <>
                        {item.report.note && (
                          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                            {item.report.note}
                          </p>
                        )}
                        {item.report.lessons.map((lesson) => (
                          <LessonCard
                            key={lesson.lessonId}
                            courseId={courseId}
                            lesson={lesson}
                            canUpdateLessons={canUpdateLessons}
                            onAddExplanation={(l, t) => void generateSupplement(l, t)}
                          />
                        ))}
                      </>
                    )}

                    {index === lastAssistantIndex && !loading && item.suggestions && item.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => void send(suggestion)}
                            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {started ? "Thinking..." : "Loading statistics..."}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Input
              value={input}
              maxLength={2000}
              disabled={loading || !started}
              placeholder="Ask about the student questions, e.g. which lesson has the most unanswered questions?"
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" size="icon" disabled={loading || !started || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!supplement}
        onOpenChange={(next) => {
          if (!next && !supplement?.saving) setSupplement(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Extra explanation: {supplement?.topic.topic}</DialogTitle>
            <DialogDescription>
              Review and edit the text. It is added to the end of &quot;{supplement?.lesson.lessonTitle}&quot; only
              when you press Add to lesson.
            </DialogDescription>
          </DialogHeader>

          {supplement?.loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing the explanation...
            </div>
          ) : (
            <textarea
              value={supplement?.text ?? ""}
              rows={12}
              maxLength={5000}
              onChange={(e) => setSupplement((s) => (s ? { ...s, text: e.target.value } : s))}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={!supplement || supplement.loading || supplement.saving}
              onClick={() => supplement && void generateSupplement(supplement.lesson, supplement.topic)}
            >
              Write again
            </Button>
            <Button
              disabled={!supplement || supplement.loading || supplement.saving || !supplement.text.trim()}
              onClick={() => void appendSupplement()}
            >
              {supplement?.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}