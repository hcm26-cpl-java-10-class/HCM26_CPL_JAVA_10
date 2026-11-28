import { aiTutorApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AiTutorLanguage,
  AiTutorMessage,
  AiTutorQuizQuestion,
} from "@/types/features/demo/ai-tutor";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  enrollmentId: number;
  lessonId: number;
  className?: string;
}

const MAX_QUESTION_LENGTH = 2000; // keep in sync with AiTutorDTO.ChatMessage on the backend
const MAX_HISTORY = 12; // keep in sync with AiTutorDTO.ChatRequest on the backend

function errorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? error?.response?.data?.error ?? fallback;
}

/**
 * Lesson-grounded AI helper: ask questions about the lesson, or build a throw-away practice quiz.
 * The quiz is a self-check only; it is never graded or stored.
 */
export function AiTutorPanel({ enrollmentId, lessonId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "quiz">("chat");
  const [language, setLanguage] = useState<AiTutorLanguage>("en");

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border bg-muted/20 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" /> AI Tutor
          <span className="text-xs font-normal text-muted-foreground">
            Ask about this lesson or practice with a quick quiz
          </span>
        </span>
        <span className="text-sm text-muted-foreground">{open ? "Hide" : "Open"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="tablist">
              {([["chat", "Ask the tutor"], ["quiz", "Practice quiz"]] as const).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  size="sm"
                  variant={tab === id ? "default" : "outline"}
                  onClick={() => setTab(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Answer in:</span>
              {(["en", "vi"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={
                    "rounded-full border px-2 py-0.5 " +
                    (language === code ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                  }
                >
                  {code === "en" ? "English" : "Tiếng Việt"}
                </button>
              ))}
            </div>
          </div>

          {/* Both tabs stay mounted so switching does not lose the conversation or the quiz. */}
          <div hidden={tab !== "chat"}>
            <TutorChat enrollmentId={enrollmentId} lessonId={lessonId} language={language} />
          </div>
          <div hidden={tab !== "quiz"}>
            <PracticeQuiz enrollmentId={enrollmentId} lessonId={lessonId} language={language} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            AI can make mistakes. Check important answers against the lesson.
          </p>
        </div>
      )}
    </section>
  );
}

function TutorChat({ enrollmentId, lessonId, language }: Props & { language: AiTutorLanguage }) {
  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [ungrounded, setUngrounded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (history: AiTutorMessage[]) =>
      aiTutorApi.chat(enrollmentId, lessonId, history.slice(-MAX_HISTORY), language),
    onSuccess: (res) => {
      setUngrounded(!res.lessonTextAvailable);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    },
    onError: (error) => toast.error(errorMessage(error, "The AI Tutor could not answer. Please try again.")),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length, mutation.isPending]);

  const send = () => {
    const text = draft.trim();
    if (!text || mutation.isPending) return;
    const next: AiTutorMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    mutation.mutate(next);
  };

  return (
    <div>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Try: “Explain the main idea in simple words” or “Give me an example”.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
              (m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")
            }
          >
            {m.content}
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>
      {ungrounded && (
        <p className="mt-2 text-xs text-amber-600">
          This lesson has no written content, so the tutor cannot see it. Answers are general.
        </p>
      )}
      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={draft}
          maxLength={MAX_QUESTION_LENGTH}
          rows={2}
          placeholder="Ask a question about this lesson…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="button" onClick={send} disabled={!draft.trim() || mutation.isPending} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PracticeQuiz({ enrollmentId, lessonId, language }: Props & { language: AiTutorLanguage }) {
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<AiTutorQuizQuestion[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});

  const mutation = useMutation({
    mutationFn: () => aiTutorApi.quiz(enrollmentId, lessonId, count, language),
    onSuccess: (res) => {
      setQuestions(res.questions);
      setPicked({});
    },
    onError: (error) => toast.error(errorMessage(error, "Could not build a quiz. Please try again.")),
  });

  const answered = Object.keys(picked).length;
  const correct = questions.filter((q, i) => picked[i] === q.correctIndex).length;
  const done = questions.length > 0 && answered === questions.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor={`tutor-quiz-count-${lessonId}`}>Questions</label>
        <select
          id={`tutor-quiz-count-${lessonId}`}
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        >
          {[3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <Button type="button" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <><Loader2 className="mr-1 size-4 animate-spin" /> Building…</>
          ) : questions.length ? (
            <><RotateCcw className="mr-1 size-4" /> New quiz</>
          ) : (
            "Generate quiz"
          )}
        </Button>
        <span className="text-xs text-muted-foreground">Practice only: not graded and not saved.</span>
      </div>

      <ol className="mt-4 space-y-4">
        {questions.map((q, qi) => {
          const choice = picked[qi];
          const revealed = choice !== undefined;
          return (
            <li key={qi} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
              <div className="mt-2 space-y-1.5">
                {q.options.map((option, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const style = !revealed
                    ? "hover:bg-muted"
                    : isCorrect
                      ? "border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
                      : oi === choice
                        ? "border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
                        : "opacity-60";
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={revealed}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={"flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm " + style}
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{option}</span>
                      {revealed && isCorrect && <CheckCircle2 className="size-4" />}
                      {revealed && !isCorrect && oi === choice && <XCircle className="size-4" />}
                    </button>
                  );
                })}
              </div>
              {revealed && q.explanation && (
                <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <p className="mt-3 text-sm font-medium" role="status">
          You got {correct} of {questions.length} correct.
        </p>
      )}
    </div>
  );
}
