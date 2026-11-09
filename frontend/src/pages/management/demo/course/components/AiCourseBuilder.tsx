import { aiCourseBuilderApi } from "@/api/features/demo/ai-course-builder.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  AiChatMessage,
  AiCourseLevel,
  AiLanguage,
  AiCourseOption,
  AiCourseOutline,
} from "@/types/features/demo/ai-course-builder";
import { ArrowLeft, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type ChatItem = {
  role: "user" | "assistant";
  text: string;
  options?: AiCourseOption[];
};

const EXAMPLES = [
  "Tạo khóa học Python cơ bản cho người mới bắt đầu",
  "Create a course on UX design for junior designers",
];

const countLessons = (course: AiCourseOutline) =>
  course.sections.reduce((sum, s) => sum + s.lessons.length, 0);

/** Compact text sent back to the AI so it knows which options it proposed (API limit: 4000 chars per message). */
function toHistoryText(item: ChatItem): string {
  if (!item.options?.length) return item.text;
  const lines = item.options.map((o, i) => {
    const sections = o.course.sections.map((s) => `${s.title} (${s.lessons.length})`).join("; ");
    return `Option ${i + 1} "${o.label}": ${o.course.name} - ${sections}`;
  });
  return `${item.text}\n${lines.join("\n")}`.slice(0, 3900);
}

function OptionCard({ option, onChoose }: { option: AiCourseOption; onChoose: () => void }) {
  const { course } = option;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{option.label}</p>
          {option.rationale && <p className="mt-0.5 text-sm text-muted-foreground">{option.rationale}</p>}
        </div>
        <Badge variant="secondary" className="shrink-0">
          {course.sections.length} sections · {countLessons(course)} lessons
        </Badge>
      </div>
      <ol className="mt-3 space-y-1 text-sm">
        {course.sections.map((section, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="truncate">
              {i + 1}. {section.title}
            </span>
            <span className="shrink-0 text-muted-foreground">{section.lessons.length}</span>
          </li>
        ))}
      </ol>
      <Button size="sm" className="mt-4 w-full" onClick={onChoose}>
        Choose this outline
      </Button>
    </div>
  );
}

function OutlineEditor({
  draft,
  onChange,
}: {
  draft: AiCourseOutline;
  onChange: (next: AiCourseOutline) => void;
}) {
  const updateSection = (si: number, title: string) =>
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) => (i === si ? { ...s, title } : s)),
    });
  const removeSection = (si: number) =>
    onChange({ ...draft, sections: draft.sections.filter((_, i) => i !== si) });
  const updateLesson = (si: number, li: number, title: string) =>
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === si ? { ...s, lessons: s.lessons.map((l, j) => (j === li ? { ...l, title } : l)) } : s,
      ),
    });
  const removeLesson = (si: number, li: number) =>
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === si ? { ...s, lessons: s.lessons.filter((_, j) => j !== li) } : s,
      ),
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Course name</label>
        <Input
          value={draft.name}
          maxLength={150}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={draft.description}
          maxLength={500}
          rows={3}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="text-sm font-medium">Level</label>
        <select
          value={draft.level}
          onChange={(e) => onChange({ ...draft, level: e.target.value as AiCourseLevel })}
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </select>
      </div>

      {draft.sections.map((section, si) => (
        <div key={si} className="rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 text-sm text-muted-foreground">{si + 1}.</span>
            <Input
              value={section.title}
              maxLength={150}
              className="font-medium"
              onChange={(e) => updateSection(si, e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove section"
              onClick={() => removeSection(si)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 space-y-2 pl-8">
            {section.lessons.map((lesson, li) => (
              <div key={li} className="flex items-center gap-2">
                <Input
                  value={lesson.title}
                  maxLength={200}
                  onChange={(e) => updateLesson(si, li, e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove lesson"
                  onClick={() => removeLesson(si, li)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiCourseBuilderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<AiCourseOutline | null>(null);
  const [creating, setCreating] = useState(false);
  const [language, setLanguage] = useState<AiLanguage>("en");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading, draft]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const next: ChatItem[] = [...items, { role: "user", text: content }];
    setItems(next);
    setInput("");
    setLoading(true);

    // Send the last 20 turns, and the first one must be from the user.
    let history: AiChatMessage[] = next
      .slice(-20)
      .map((m) => ({ role: m.role, content: toHistoryText(m) }));
    while (history.length > 0 && history[0].role !== "user") history = history.slice(1);

    try {
      const res = await aiCourseBuilderApi.chat(history, language);
      setItems([...next, { role: "assistant", text: res.reply, options: res.options }]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "The AI could not answer. Please try again.");
      setItems(next);
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    if (!draft || creating) return;
    setCreating(true);
    try {
      const result = await aiCourseBuilderApi.apply(draft);
      toast.success(
        `Created "${result.courseName}" as a draft (${result.sections} sections, ${result.lessons} lessons)`,
      );
      onOpenChange(false);
      navigate(`/courses/${result.courseId}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Could not create the course.");
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    !!draft &&
    draft.name.trim().length >= 3 &&
    draft.sections.length > 0 &&
    draft.sections.every((s) => s.title.trim().length >= 3 && s.lessons.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Create a course with AI
          </SheetTitle>
          <SheetDescription>
            Describe your course. The AI suggests outlines to choose from; nothing is saved until you confirm.
          </SheetDescription>
        </SheetHeader>

        {draft ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => setDraft(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to options
              </Button>
              <OutlineEditor draft={draft} onChange={setDraft} />
            </div>
            <div className="border-t p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                The course is created as a Draft. Each lesson gets the AI summary as draft text; you can replace it
                with your own content, then assign categories and publish.
              </p>
              <Button className="w-full" disabled={!canCreate || creating} onClick={create}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create course ({draft.sections.length} sections · {countLessons(draft)} lessons)
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {items.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Try one of these:</p>
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => send(example)}
                      className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}

              {items.map((item, index) => (
                <div key={index} className={item.role === "user" ? "flex justify-end" : "space-y-3"}>
                  {item.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {item.text}
                    </div>
                  ) : (
                    <>
                      {item.text && (
                        <div className="max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm">{item.text}</div>
                      )}
                      {item.options?.map((option, i) => (
                        <OptionCard
                          key={i}
                          option={option}
                          onChoose={() => setDraft(structuredClone(option.course))}
                        />
                      ))}
                    </>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Designing your course...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 border-t px-4 pt-3 text-xs text-muted-foreground">
              <span>Course language:</span>
              {(["en", "vi"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={
                    "rounded-full border px-3 py-1 " +
                    (language === code ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                  }
                >
                  {code === "en" ? "English" : "Tiếng Việt"}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <Input
                value={input}
                maxLength={4000}
                disabled={loading}
                placeholder={items.length ? "Ask for changes, e.g. add a hands-on project" : "What course do you want to create?"}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Header button for the Courses page. Only shown to users who can create courses. */
export function AiCourseBuilderButton() {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!hasPermission("COURSE_CREATE")) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Create with AI
      </Button>
      <AiCourseBuilderSheet open={open} onOpenChange={setOpen} />
    </>
  );
}