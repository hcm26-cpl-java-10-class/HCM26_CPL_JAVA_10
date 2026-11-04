import { examApi, questionApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExamDTO, QuestionDTO, QuestionDifficulty, QuestionType } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Dices, Eye, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "./examConfig";
import { EditExamQuestionDialog, isExamStarted, QuestionAnswers } from "./ExamQuestionParts";

const PAGE_SIZE = 8;

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice",
  ESSAY: "Essay",
  CODING: "Coding",
};

const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

const DIFFICULTY_STYLE: Record<QuestionDifficulty, string> = {
  EASY: "text-emerald-600 dark:text-emerald-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  HARD: "text-red-600 dark:text-red-400",
};

const normalizeTopic = (topic?: string | null) => (topic ?? "").trim().toLowerCase();

function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function QuestionMeta({ q }: { q: QuestionDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{TYPE_LABEL[q.type]}</span>
      <span className={`font-semibold ${DIFFICULTY_STYLE[q.difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
      <span className="text-muted-foreground">Weight: {q.points}</span>
    </div>
  );
}

/** One question of the library. The text is cut short; More / Less shows all of it. */
function LibraryCard({
  q,
  state,
  locked,
  onAdd,
  onUndo,
  onPreview,
}: {
  q: QuestionDTO;
  state: "available" | "staged" | "inExam";
  locked: boolean;
  onAdd: () => void;
  onUndo: () => void;
  onPreview: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const longText = q.content.length > 140 || q.content.includes("\n") || q.type === "MULTIPLE_CHOICE" || q.type === "CODING";
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-xs ${state === "inExam" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <QuestionMeta q={q} />
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-primary" onClick={onPreview}>
            <Eye className="size-3.5" />
            Preview
          </Button>
          {state === "available" && (
            <Button type="button" size="icon-sm" aria-label="Add to selected questions" title="Add to selected questions" disabled={locked} onClick={onAdd}>
              <Plus className="size-4" />
            </Button>
          )}
          {state === "staged" && (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-emerald-600" title="Click to remove from the selection" onClick={onUndo}>
              <Check className="size-3.5" />
              Added
            </Button>
          )}
          {state === "inExam" && <Badge variant="outline" className="text-[10px]">In exam</Badge>}
        </div>
      </div>

      <p className={`mt-3 whitespace-pre-wrap break-words text-sm ${expanded ? "" : "line-clamp-2"}`}>{q.content}</p>
      {expanded && <QuestionAnswers question={q} />}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap gap-1.5">
          {q.topic?.trim() && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{q.topic.trim()}</span>}
        </div>
        {longText && (
          <button type="button" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "More"}
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function ExamQuestionsPanel({ examId }: { examId: number }) {
  const queryClient = useQueryClient();
  const examQuery = useQuery({
    queryKey: ["exam-detail", examId],
    queryFn: () => examApi.getById(String(examId)),
  });
  const activeExam: ExamDTO | null = examQuery.data ?? null;
  const setActiveExam = (exam: ExamDTO | null) => {
    if (exam) queryClient.setQueryData(["exam-detail", examId], exam);
  };

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<QuestionType>>(new Set());
  const [difficultyFilter, setDifficultyFilter] = useState<Set<QuestionDifficulty>>(new Set());
  const [topicFilter, setTopicFilter] = useState<Set<string>>(new Set());
  const [hideAdded, setHideAdded] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(0);

  // Selection / dialogs
  const [stagedQuestions, setStagedQuestions] = useState<QuestionDTO[]>([]);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionDTO | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionDTO | null>(null);
  const [isRandomOpen, setIsRandomOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [randomTopic, setRandomTopic] = useState<string>("");
  const [randomDifficulty, setRandomDifficulty] = useState<string>("ALL");
  const [randomQuestionType, setRandomQuestionType] = useState<string>("ALL");

  const lockedQuestionType: QuestionType | null =
      activeExam?.examType === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE"
          : activeExam?.examType === "ESSAY" ? "ESSAY"
          : activeExam?.examType === "CODING" ? "CODING"
              : null;
  const isPairExam = activeExam?.examType === "MC_CODING";
  const allowedTypes: QuestionType[] = lockedQuestionType
      ? [lockedQuestionType]
      : isPairExam ? ["MULTIPLE_CHOICE", "CODING"] : ["MULTIPLE_CHOICE", "ESSAY", "CODING"];
  const activeExamStarted = isExamStarted(activeExam);

  const bankQuery = useQuery({
    queryKey: ["exam-question-all-bank", lockedQuestionType],
    enabled: Boolean(activeExam?.id),
    queryFn: () =>
        questionApi.getPage(
            { page: 0, size: 2000, sort: "id,desc" },
            undefined,
            { isActive: true, ...(lockedQuestionType ? { type: lockedQuestionType } : {}) },
        ),
    staleTime: 30_000,
  });
  const allBankQuestions = useMemo(
    () => (bankQuery.data?.content ?? []).filter((q) => allowedTypes.includes(q.type)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bankQuery.data?.content, lockedQuestionType, isPairExam],
  );

  const refreshExams = () => {
    void queryClient.invalidateQueries({ queryKey: ["exam-management"] });
  };

  const addQuestionsMutation = useMutation({
    mutationFn: (ids: number[]) => examApi.addQuestions(activeExam!.id!, ids),
    onSuccess: (exam) => {
      setActiveExam(exam);
      refreshExams();
      void queryClient.invalidateQueries({ queryKey: ["exam-question-all-bank"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to add questions to exam")),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: ({ examId: id, questionId }: { examId: number; questionId: number }) =>
        examApi.removeQuestion(id, questionId),
    onSuccess: (exam) => {
      setActiveExam(exam);
      refreshExams();
      void queryClient.invalidateQueries({ queryKey: ["exam-question-all-bank"] });
      toast.success("Question removed from exam");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to remove question from exam")),
  });

  const sourceIdsInExam = useMemo(() => {
    const set = new Set<number>();
    (activeExam?.questions ?? []).forEach((q) => {
      if (q.sourceQuestionId != null) set.add(q.sourceQuestionId);
      if (q.id != null) set.add(q.id);
    });
    return set;
  }, [activeExam?.questions]);
  const stagedIds = useMemo(() => new Set(stagedQuestions.map((q) => q.id)), [stagedQuestions]);

  const stagedPoints = stagedQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
  const totalPointsInExam = (activeExam?.totalPoints ?? 0) + stagedPoints;
  const totalQuestionsInExamCount = (activeExam?.questions?.length ?? 0) + stagedQuestions.length;

  const topicCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const q of allBankQuestions) {
      const label = (q.topic ?? "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      counts.set(key, { label, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    return [...counts.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [allBankQuestions]);
  const topicList = topicCounts.map(([, v]) => v.label);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allBankQuestions.filter((q) => {
      if (typeFilter.size > 0 && !typeFilter.has(q.type)) return false;
      if (difficultyFilter.size > 0 && !difficultyFilter.has(q.difficulty)) return false;
      if (topicFilter.size > 0 && !topicFilter.has(normalizeTopic(q.topic))) return false;
      if (hideAdded && (sourceIdsInExam.has(q.id) || stagedIds.has(q.id))) return false;
      if (s && !(q.content || "").toLowerCase().includes(s) && !(q.topic || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [allBankQuestions, search, typeFilter, difficultyFilter, topicFilter, hideAdded, sourceIdsInExam, stagedIds]);

  useEffect(() => setPage(0), [search, typeFilter, difficultyFilter, topicFilter, hideAdded]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const addable = filtered.filter((q) => !sourceIdsInExam.has(q.id) && !stagedIds.has(q.id));
  const hasFilters = search !== "" || typeFilter.size > 0 || difficultyFilter.size > 0 || topicFilter.size > 0;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter(new Set());
    setDifficultyFilter(new Set());
    setTopicFilter(new Set());
  };

  const stageQuestion = (q: QuestionDTO) => {
    if (activeExamStarted || sourceIdsInExam.has(q.id)) return;
    setStagedQuestions((prev) => (prev.some((item) => item.id === q.id) ? prev : [...prev, q]));
  };
  const unstageQuestion = (id: number) => setStagedQuestions((prev) => prev.filter((item) => item.id !== id));

  const addAllMatching = () => {
    if (activeExamStarted || addable.length === 0) return;
    setStagedQuestions((prev) => {
      const existing = new Set(prev.map((q) => q.id));
      return [...prev, ...addable.filter((q) => !existing.has(q.id))];
    });
    toast.success(`Added ${addable.length} question(s) to the selection. Click "Save to Exam" to keep them.`);
  };

  const handleSaveStagedToExam = () => {
    if (activeExamStarted) {
      toast.error("Exam has started, questions cannot be added.");
      return;
    }
    if (!activeExam?.id || stagedQuestions.length === 0) return;
    const ids = stagedQuestions.map((q) => q.id);
    addQuestionsMutation.mutate(ids, {
      onSuccess: () => {
        setStagedQuestions([]);
        toast.success(`Saved ${ids.length} question(s) to exam successfully!`);
      },
    });
  };

  const openRandomDialog = () => {
    setRandomTopic(topicFilter.size === 1 ? (topicCounts.find(([k]) => topicFilter.has(k))?.[1].label ?? "") : "");
    setRandomDifficulty(difficultyFilter.size === 1 ? [...difficultyFilter][0] : "ALL");
    setRandomQuestionType(lockedQuestionType ?? (typeFilter.size === 1 ? [...typeFilter][0] : "ALL"));
    setIsRandomOpen(true);
  };

  const allAvailableBankQuestions = useMemo(
    () => allBankQuestions.filter((q) => !sourceIdsInExam.has(q.id) && !stagedIds.has(q.id)),
    [allBankQuestions, sourceIdsInExam, stagedIds],
  );

  const eligibleForRandom = useMemo(() => {
    return allBankQuestions.filter((q) => {
      if (sourceIdsInExam.has(q.id)) return false;
      const typeToFilter = lockedQuestionType ?? (randomQuestionType !== "ALL" ? randomQuestionType : null);
      if (typeToFilter && q.type !== typeToFilter) return false;
      if (isPairExam && q.type === "ESSAY") return false;
      if (randomDifficulty !== "ALL" && q.difficulty !== randomDifficulty) return false;
      if (randomTopic.trim()) {
        if ((q.topic || "").trim().toLowerCase() !== randomTopic.trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [allBankQuestions, sourceIdsInExam, lockedQuestionType, isPairExam, randomQuestionType, randomDifficulty, randomTopic]);

  const handleConfirmRandomAdd = () => {
    if (eligibleForRandom.length === 0) {
      toast.warning("No eligible questions available to add!");
      return;
    }
    const count = Math.min(randomCount, eligibleForRandom.length);
    const shuffled = [...eligibleForRandom];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, count);
    setStagedQuestions((prev) => {
      const existing = new Set(prev.map((q) => q.id));
      return [...prev, ...picked.filter((q) => !existing.has(q.id))];
    });
    setIsRandomOpen(false);
    toast.success(`Added ${picked.length} random question(s) to the selection! Click "Save to Exam" to keep them.`);
  };

  if (examQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading questions...</p>;
  }
  if (!activeExam) {
    return <p className="py-10 text-center text-sm text-destructive">Failed to load the exam.</p>;
  }

  const savedQuestions = activeExam.questions ?? [];
  const selectedAll = [...savedQuestions, ...stagedQuestions];
  const typeSummary = allowedTypes
    .map((type) => {
      const items = selectedAll.filter((q) => q.type === type);
      return { type, count: items.length, points: items.reduce((sum, q) => sum + (q.points || 0), 0) };
    })
    .filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-3">
      {activeExamStarted && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Exam has started. Adding, editing, and removing questions are disabled to protect student results.</span>
        </div>
      )}

      <div className={`grid gap-4 lg:h-[calc(100vh-12rem)] lg:min-h-[36rem] ${
        filtersOpen ? "lg:grid-cols-[230px_minmax(0,1fr)_minmax(300px,0.75fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.6fr)]"
      }`}>
        {/* ---------------- Filters ---------------- */}
        <aside className={`min-h-0 flex-col gap-4 overflow-y-auto rounded-md border p-4 ${filtersOpen ? "flex" : "hidden"}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Filters</h3>
            <button type="button" className="text-xs text-primary hover:underline disabled:opacity-40" disabled={!hasFilters} onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search questions" className="pl-8" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Question type</legend>
            {allowedTypes.map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={typeFilter.has(type)} onChange={() => setTypeFilter((s) => toggleIn(s, type))} />
                {TYPE_LABEL[type]}
              </label>
            ))}
            {allowedTypes.length < 3 && <p className="text-[11px] text-muted-foreground">Limited by the exam&apos;s question format.</p>}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Difficulty</legend>
            {(["EASY", "MEDIUM", "HARD"] as QuestionDifficulty[]).map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={difficultyFilter.has(d)} onChange={() => setDifficultyFilter((s) => toggleIn(s, d))} />
                {DIFFICULTY_LABEL[d]}
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Topic</legend>
            {topicCounts.length === 0 && <p className="text-xs text-muted-foreground">No topics.</p>}
            {topicCounts.map(([key, { label, count }]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={topicFilter.has(key)} onChange={() => setTopicFilter((s) => toggleIn(s, key))} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </label>
            ))}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 border-t pt-3 text-sm">
            <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={hideAdded} onChange={(e) => setHideAdded(e.target.checked)} />
            Hide questions already in the exam
          </label>
        </aside>

        {/* ---------------- Question library ---------------- */}
        <section className="flex min-h-0 flex-col rounded-md border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div>
              <h3 className="text-sm font-semibold">Question library</h3>
              <p className="text-xs text-muted-foreground">{filtered.length} question(s)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" aria-pressed={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
                <SlidersHorizontal className="mr-1 size-4" />
                {filtersOpen ? "Hide filters" : "Show filters"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={activeExamStarted || addable.length === 0} onClick={addAllMatching}>
                <Plus className="mr-1 size-4" />
                Add all matching ({addable.length})
              </Button>
              <Button type="button" size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={activeExamStarted} onClick={openRandomDialog}>
                <Dices className="mr-1 size-4" />
                Random...
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3">
            {bankQuery.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading questions...</p>}
            {bankQuery.isError && <p className="py-10 text-center text-sm text-destructive">Failed to load questions.</p>}
            {!bankQuery.isLoading && !bankQuery.isError && pageRows.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No matching questions found.</p>
            )}
            {pageRows.map((q) => (
              <LibraryCard
                key={q.id}
                q={q}
                state={sourceIdsInExam.has(q.id) ? "inExam" : stagedIds.has(q.id) ? "staged" : "available"}
                locked={activeExamStarted}
                onAdd={() => stageQuestion(q)}
                onUndo={() => unstageQuestion(q.id)}
                onPreview={() => setPreviewQuestion(q)}
              />
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 border-t p-3">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="min-w-20 text-center text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </section>

        {/* ---------------- Selected questions ---------------- */}
        <section className="flex min-h-0 flex-col rounded-md border">
          <div className="border-b p-3">
            <h3 className="text-sm font-semibold">
              Selected questions ({totalQuestionsInExamCount})
              {stagedQuestions.length > 0 && (
                <Badge className="ml-2 bg-emerald-600 px-1.5 py-0 text-[10px] font-normal text-white">+{stagedQuestions.length} new</Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Total weight: {totalPointsInExam} · Max score: {activeExam.maxScore ?? 10}
            </p>
            {typeSummary.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {typeSummary.map((row) => (
                  <span key={row.type} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    {TYPE_LABEL[row.type]}: {row.count} · weight {row.points}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-3">
            {totalQuestionsInExamCount === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                <p className="text-sm font-medium">No questions added yet</p>
                <p className="mt-1 text-xs">Click + on a question in the library to add it here.</p>
              </div>
            )}

            {savedQuestions.map((q, idx) => (
              <div key={q.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-primary">Question {idx + 1}</span>
                  <div className="flex items-center gap-0.5">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Preview question" title="Preview" onClick={() => setPreviewQuestion(q)}>
                      <Eye className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit question" title={activeExamStarted ? "Exam has started" : "Edit question points/content"} disabled={activeExamStarted} onClick={() => setEditingQuestion(q)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove question from exam"
                      title={activeExamStarted ? "Exam has started" : "Remove question from exam"}
                      disabled={activeExamStarted || removeQuestionMutation.isPending}
                      onClick={() => removeQuestionMutation.mutate({ examId: activeExam.id!, questionId: q.id })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1"><QuestionMeta q={q} /></div>
                <p className="mt-2 line-clamp-2 text-xs">{q.content}</p>
              </div>
            ))}

            {stagedQuestions.map((q, idx) => (
              <div key={q.id} className="rounded-md border-2 border-emerald-500/40 bg-emerald-500/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Question {savedQuestions.length + idx + 1} · not saved yet
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Preview question" title="Preview" onClick={() => setPreviewQuestion(q)}>
                      <Eye className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="Remove from the selection" title="Remove from the selection" disabled={activeExamStarted} onClick={() => unstageQuestion(q.id)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1"><QuestionMeta q={q} /></div>
                <p className="mt-2 line-clamp-2 text-xs">{q.content}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t p-3">
            <Button
              type="button"
              className="h-9 w-full bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700"
              disabled={activeExamStarted || stagedQuestions.length === 0 || addQuestionsMutation.isPending}
              onClick={handleSaveStagedToExam}
            >
              <Save className="mr-1.5 size-4" />
              {addQuestionsMutation.isPending
                ? "Saving to exam..."
                : stagedQuestions.length > 0
                  ? `Save ${stagedQuestions.length} Question(s) to Exam`
                  : "Save to Exam"}
            </Button>
            <p className={`text-center text-[11px] ${stagedQuestions.length > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              {stagedQuestions.length > 0
                ? `${stagedQuestions.length} question(s) are only in this list. Click "Save to Exam" to keep them.`
                : "All selected questions are saved."}
            </p>
          </div>
        </section>
      </div>

      {/* Preview */}
      <Dialog open={previewQuestion !== null} onOpenChange={(open) => { if (!open) setPreviewQuestion(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question preview</DialogTitle>
            <DialogDescription>{previewQuestion && <QuestionMeta q={previewQuestion} />}</DialogDescription>
          </DialogHeader>
          {previewQuestion && (
            <div className="grid gap-3">
              <p className="whitespace-pre-wrap break-words text-sm">{previewQuestion.content}</p>
              {previewQuestion.imageUrl && <img src={previewQuestion.imageUrl} alt="" className="max-h-64 rounded-md border object-contain" />}
              {previewQuestion.type === "CODING" && previewQuestion.code && (
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {`public static ${previewQuestion.code.returnType} ${previewQuestion.code.functionName}(${previewQuestion.code.params.map((p) => `${p.type} ${p.name}`).join(", ")})`}
                </pre>
              )}
              <QuestionAnswers question={previewQuestion} />
              {previewQuestion.topic?.trim() && <p className="text-xs text-muted-foreground">Topic: {previewQuestion.topic.trim()}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRandomOpen} onOpenChange={setIsRandomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dices className="size-5 text-indigo-600" />
              Add Random Questions
            </DialogTitle>
            <DialogDescription>
              Select quantity and scope to randomly select and add questions into this exam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Quick Select Quantity</label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 30, 50].map((num) => (
                    <Button
                        key={num}
                        type="button"
                        variant={randomCount === num ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8 font-medium"
                        onClick={() => setRandomCount(num)}
                    >
                      {num} Questions
                    </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Or Enter Custom Number</label>
              <Input
                  type="number"
                  min={1}
                  max={eligibleForRandom.length || 100}
                  value={randomCount}
                  onChange={(e) => setRandomCount(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="e.g. 15, 25, 50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Topic</label>
              <Select value={randomTopic || "ALL"} onValueChange={(val) => setRandomTopic(val === "ALL" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    All Topics ({allAvailableBankQuestions.length} available)
                  </SelectItem>
                  {topicList.map((t) => {
                    const count = allBankQuestions.filter(
                        (q) => !sourceIdsInExam.has(q.id) && (q.topic || "").trim().toLowerCase() === t.toLowerCase()
                    ).length;
                    return (
                        <SelectItem key={t} value={t} disabled={count === 0}>
                          {t} ({count} available)
                        </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Question Type</label>
                <Select
                    value={lockedQuestionType ?? randomQuestionType}
                    disabled={lockedQuestionType !== null}
                    onValueChange={setRandomQuestionType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                    {!isPairExam && <SelectItem value="ESSAY">Essay</SelectItem>}
                    <SelectItem value="CODING">Coding</SelectItem>
                  </SelectContent>
                </Select>
                {lockedQuestionType && (
                    <p className="text-[10px] text-muted-foreground">Locked by exam type</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Difficulty</label>
                <Select value={randomDifficulty} onValueChange={setRandomDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Difficulties</SelectItem>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md bg-muted p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Available in {randomTopic ? `topic "${randomTopic}"` : "all topics"}:</span>
                <span className="font-semibold text-foreground">{eligibleForRandom.length} questions</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Will add to exam:</span>
                <span className="font-semibold text-indigo-600">
                  {Math.min(randomCount, eligibleForRandom.length)} question(s)
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsRandomOpen(false)}>
              Cancel
            </Button>
            <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={eligibleForRandom.length === 0 || addQuestionsMutation.isPending}
                onClick={handleConfirmRandomAdd}
            >
              {addQuestionsMutation.isPending
                  ? "Adding..."
                  : `Add ${Math.min(randomCount, eligibleForRandom.length)} Random Question(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingQuestion && activeExam && (
        <EditExamQuestionDialog
          exam={activeExam}
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={(updatedExam: ExamDTO) => {
            setActiveExam(updatedExam);
            setEditingQuestion(null);
            refreshExams();
          }}
        />
      )}
    </div>
  );
}
