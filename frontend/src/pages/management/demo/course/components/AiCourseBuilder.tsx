import { aiCourseBuilderApi } from "@/api/features/demo/ai-course-builder.api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
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
  AiApplyResult,
  AiChatMessage,
  AiCourseLevel,
  AiCourseOption,
  AiCourseOutline,
  AiLanguage,
  AiOptionsResponse,
} from "@/types/features/demo/ai-course-builder";
import { ArrowLeft, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
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

// Same limits as the backend (AiCourseBuilderService / Course, Section, Lesson DTOs).
const LIMITS = {
  name: 150,
  description: 500,
  sectionTitle: 150,
  lessonTitle: 200,
  sections: 20,
  lessonsPerSection: 15,
  totalLessons: 150,
};

type SectionErrors = { title?: string; general?: string; lessons: (string | undefined)[] };
type OutlineErrors = {
  name?: string;
  description?: string;
  general?: string;
  sections: SectionErrors[];
  hasError: boolean;
};

function validateOutline(draft: AiCourseOutline): OutlineErrors {
  const errors: OutlineErrors = { sections: [], hasError: false };

  const name = draft.name.trim();
  if (name.length < 3) errors.name = "Course name must be at least 3 characters";
  else if (name.length > LIMITS.name) errors.name = `Course name must be at most ${LIMITS.name} characters`;

  if (draft.description.length > LIMITS.description) {
    errors.description = `Description must be at most ${LIMITS.description} characters`;
  }

  if (draft.sections.length === 0) errors.general = "Add at least one section";
  else if (draft.sections.length > LIMITS.sections) {
    errors.general = `A course can have at most ${LIMITS.sections} sections`;
  }

  const seen = new Set<string>();
  let totalLessons = 0;
  for (const section of draft.sections) {
    const se: SectionErrors = { lessons: [] };
    const title = section.title.trim();
    if (title.length < 3) se.title = "Section title must be at least 3 characters";
    else if (title.length > LIMITS.sectionTitle) se.title = `Section title must be at most ${LIMITS.sectionTitle} characters`;
    else if (seen.has(title.toLowerCase())) se.title = "Duplicate section title";
    else seen.add(title.toLowerCase());

    if (section.lessons.length === 0) se.general = "Each section needs at least one lesson";
    else if (section.lessons.length > LIMITS.lessonsPerSection) {
      se.general = `At most ${LIMITS.lessonsPerSection} lessons per section`;
    }

    for (const lesson of section.lessons) {
      totalLessons++;
      const lt = lesson.title.trim();
      se.lessons.push(
        lt.length === 0
          ? "Lesson title is required"
          : lt.length > LIMITS.lessonTitle
            ? `Lesson title must be at most ${LIMITS.lessonTitle} characters`
            : undefined,
      );
    }
    errors.sections.push(se);
  }
  if (!errors.general && totalLessons > LIMITS.totalLessons) {
    errors.general = `A course can have at most ${LIMITS.totalLessons} lessons in total`;
  }

  errors.hasError = Boolean(
    errors.name ||
      errors.description ||
      errors.general ||
      errors.sections.some((se) => se.title || se.general || se.lessons.some(Boolean)),
  );
  return errors;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

const errorBorder = (message?: string) => (message ? "border-destructive focus-visible:ring-destructive" : "");

function OutlineEditor({
  draft,
  errors,
  onChange,
}: {
  draft: AiCourseOutline;
  errors: OutlineErrors;
  onChange: (next: AiCourseOutline) => void;
}) {
  const updateSection = (si: number, title: string) =>
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) => (i === si ? { ...s, title } : s)),
    });
  const removeSection = (si: number) =>
    onChange({ ...draft, sections: draft.sections.filter((_, i) => i !== si) });
  const addSection = () =>
    onChange({
      ...draft,
      sections: [
        ...draft.sections,
        { title: "", lessons: [{ title: "", summary: "", durationMinutes: 10 }] },
      ],
    });
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
  const addLesson = (si: number) =>
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === si
          ? { ...s, lessons: [...s.lessons, { title: "", summary: "", durationMinutes: 10 }] }
          : s,
      ),
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Course name <span className="text-destructive">*</span>
        </label>
        <Input
          value={draft.name}
          maxLength={LIMITS.name}
          className={errorBorder(errors.name)}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <FieldError message={errors.name} />

        <label className="text-sm font-medium">Description</label>
        <textarea
          value={draft.description}
          maxLength={LIMITS.description}
          rows={3}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className={
            "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            errorBorder(errors.description)
          }
        />
        <div className="flex justify-between">
          <FieldError message={errors.description} />
          <span className="ml-auto text-xs text-muted-foreground">
            {draft.description.length}/{LIMITS.description}
          </span>
        </div>

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

      {errors.general && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.general}</p>
      )}

      {draft.sections.map((section, si) => {
        const se = errors.sections[si];
        return (
          <div key={si} className="rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <span className="w-6 pt-2 text-sm text-muted-foreground">{si + 1}.</span>
              <div className="flex-1">
                <Input
                  value={section.title}
                  maxLength={LIMITS.sectionTitle}
                  placeholder="Section title"
                  className={"font-medium " + errorBorder(se?.title)}
                  onChange={(e) => updateSection(si, e.target.value)}
                />
                <FieldError message={se?.title} />
              </div>
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
                <div key={li}>
                  <div className="flex items-center gap-2">
                    <Input
                      value={lesson.title}
                      maxLength={LIMITS.lessonTitle}
                      placeholder="Lesson title"
                      className={errorBorder(se?.lessons[li])}
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
                  <FieldError message={se?.lessons[li]} />
                </div>
              ))}
              <FieldError message={se?.general} />
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2"
                disabled={section.lessons.length >= LIMITS.lessonsPerSection}
                onClick={() => addLesson(si)}
              >
                <Plus className="mr-1 h-4 w-4" /> Add lesson
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        disabled={draft.sections.length >= LIMITS.sections}
        onClick={addSection}
      >
        <Plus className="mr-1 h-4 w-4" /> Add section
      </Button>
    </div>
  );
}

type GenState = {
  courseId: number;
  courseName: string;
  total: number;
  done: number;
  failed: number;
  current: string;
  running: boolean;
  stoppedReason?: string;
};

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
  const [pickers, setPickers] = useState<AiOptionsResponse | null>(null);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [writeContent, setWriteContent] = useState(true);
  const [gen, setGen] = useState<GenState | null>(null);
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading, draft]);

  // Teachers and categories for the pickers (optional: the window still works if this fails).
  useEffect(() => {
    if (!open || pickers) return;
    aiCourseBuilderApi
      .options()
      .then(setPickers)
      .catch(() => undefined);
  }, [open, pickers]);

  const handleOpenChange = (next: boolean) => {
    if (!next && gen?.running) {
      toast.info("Lessons are still being written. Press Stop first, or wait until it finishes.");
      return;
    }
    onOpenChange(next);
  };

  const resetAll = () => {
    setItems([]);
    setInput("");
    setDraft(null);
    setGen(null);
    setCategoryIds([]);
    setInstructorId(null);
  };

  const openCourse = (courseId: number) => {
    resetAll();
    onOpenChange(false);
    navigate(`/courses/${courseId}`);
  };

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

  const chooseOption = (option: AiCourseOption) => {
    setDraft(structuredClone(option.course));
    setCategoryIds(option.categoryIds ?? []);
    setInstructorId(
      pickers?.currentTeacherId ?? (pickers?.teachers.length === 1 ? pickers.teachers[0].id : null),
    );
  };

  const toggleCategory = (id: number) =>
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );

  /** Writes the full text of every new lesson, one after another, with progress. A failed lesson does not stop the rest. */
  const runGeneration = async (result: AiApplyResult) => {
    cancelRef.current = false;
    const total = result.lessonRefs.length;
    let done = 0;
    let failed = 0;
    let stoppedReason: string | undefined;

    setGen({
      courseId: result.courseId,
      courseName: result.courseName,
      total,
      done,
      failed,
      current: result.lessonRefs[0]?.title ?? "",
      running: true,
    });

    for (const ref of result.lessonRefs) {
      if (cancelRef.current) {
        stoppedReason = "Stopped. The remaining lessons keep the short AI summary.";
        break;
      }
      setGen((g) => (g ? { ...g, current: ref.title } : g));
      try {
        await aiCourseBuilderApi.generateLessonContent(ref.id, { save: true, overwrite: true, language });
        done++;
      } catch (error: any) {
        failed++;
        const message: string = error?.response?.data?.message ?? "";
        if (/rate limit|quota/i.test(message)) {
          stoppedReason = message;
          break;
        }
      }
      setGen((g) => (g ? { ...g, done, failed } : g));
    }
    setGen((g) => (g ? { ...g, done, failed, running: false, stoppedReason } : g));
  };

  const create = async () => {
    if (!draft || creating) return;
    setCreating(true);
    try {
      const result = await aiCourseBuilderApi.apply(draft, categoryIds, instructorId);
      if (writeContent && result.lessonRefs.length > 0) {
        void runGeneration(result);
      } else {
        toast.success(
          `Created "${result.courseName}" as a draft (${result.sections} sections, ${result.lessons} lessons)`,
        );
        openCourse(result.courseId);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Could not create the course.");
    } finally {
      setCreating(false);
    }
  };

  const errors = draft ? validateOutline(draft) : null;
  const canCreate = !!draft && !!errors && !errors.hasError;
  const lessonTotal = draft ? countLessons(draft) : 0;
  const teacherSelf = pickers?.teachers.find((t) => t.id === pickers?.currentTeacherId);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Create a course with AI
          </SheetTitle>
          <SheetDescription>
            Describe your course. The AI suggests outlines to choose from; nothing is saved until you confirm.
          </SheetDescription>
        </SheetHeader>

        {gen ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="font-medium">
                {gen.running ? "Writing lesson content..." : "Your course is ready"}
              </p>
              <p className="text-sm text-muted-foreground">
                &quot;{gen.courseName}&quot; was created as a Draft.
              </p>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(((gen.done + gen.failed) / gen.total) * 100)}%` }}
              />
            </div>
            <p className="text-sm">
              {gen.done + gen.failed}/{gen.total} lessons
              {gen.running && gen.current ? ` · now writing: ${gen.current}` : ""}
            </p>

            {gen.failed > 0 && (
              <p className="text-sm text-destructive">
                {gen.failed} lesson(s) could not be written. They keep the short AI summary; open the lesson and use
                &quot;Generate with AI&quot; to try again.
              </p>
            )}
            {gen.stoppedReason && <p className="text-sm text-muted-foreground">{gen.stoppedReason}</p>}

            {gen.running ? (
              <Button variant="outline" onClick={() => (cancelRef.current = true)}>
                Stop
              </Button>
            ) : (
              <Button onClick={() => openCourse(gen.courseId)}>Open course</Button>
            )}
          </div>
        ) : draft ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => setDraft(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to options
              </Button>

              <div className="mb-4 space-y-3 rounded-xl border p-3">
                <p className="text-sm font-medium">Course settings</p>

                {pickers?.currentTeacherId != null ? (
                  <p className="text-sm">
                    Instructor: <span className="font-medium">{teacherSelf?.name ?? "You"}</span> (you)
                  </p>
                ) : pickers ? (
                  <div>
                    <label className="text-sm font-medium">Instructor</label>
                    <select
                      value={instructorId ?? ""}
                      onChange={(e) => setInstructorId(e.target.value ? Number(e.target.value) : null)}
                      className="mt-1 h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    >
                      <option value="">No instructor yet (assign later)</option>
                      {pickers.teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
                    {pickers.teachers.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">No active teacher accounts found.</p>
                    )}
                  </div>
                ) : null}

                {pickers && (
                  <div>
                    <label className="text-sm font-medium">Categories</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {pickers.categories.map((category) => {
                        const selected = categoryIds.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            className={
                              "rounded-full border px-3 py-1 text-xs " +
                              (selected ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                            }
                          >
                            {category.name}
                          </button>
                        );
                      })}
                      {pickers.categories.length === 0 && (
                        <p className="text-xs text-muted-foreground">No active categories found.</p>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The AI pre-selected the best match. A course needs at least one category to be published.
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={writeContent}
                    onChange={(e) => setWriteContent(e.target.checked)}
                  />
                  <span>
                    Write the full lesson content with AI after creating
                    <span className="block text-xs text-muted-foreground">
                      About 10 seconds per lesson (around {Math.max(1, Math.ceil((lessonTotal * 10) / 60))} min for
                      this course). Otherwise each lesson keeps a short summary.
                    </span>
                  </span>
                </label>
              </div>

              <OutlineEditor draft={draft} errors={errors!} onChange={setDraft} />
            </div>
            <div className="border-t p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                The course is created as a Draft, so students cannot see it until you publish it.
              </p>
              {errors?.hasError && (
                <p className="mb-2 text-xs font-medium text-destructive">
                  Fix the highlighted fields to create the course.
                </p>
              )}
              <Button className="w-full" disabled={!canCreate || creating} onClick={create}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {writeContent ? "Create course & write content" : "Create course"} ({draft.sections.length} sections ·{" "}
                {lessonTotal} lessons)
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
                        <OptionCard key={i} option={option} onChoose={() => chooseOption(option)} />
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
                placeholder={
                  items.length ? "Ask for changes, e.g. add a hands-on project" : "What course do you want to create?"
                }
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

/**
 * Header actions for the Courses page: "Create with AI" + the normal manual "Create" button.
 * Because the course entity has no separate create page, AutoCrudPage would otherwise hide the default Create button.
 */
export function CourseHeaderActions({ table }: { table: any }) {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);

  return (
    <>
      {table?.permission?.canCreate && (
        <PermissionGate permission={table.permission?.keys?.create}>
          <ActionButton
            onClick={() => table.openCreate()}
            tooltip="Create course manually"
            title="Create"
            variant="default"
            icon={<Plus size={16} />}
          />
        </PermissionGate>
      )}

      {hasPermission("COURSE_CREATE") && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Create with AI
        </Button>
      )}

      <AiCourseBuilderSheet open={open} onOpenChange={setOpen} />
    </>
  );
}