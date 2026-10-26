import { examApi, questionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExamDTO, ExamType, LatePolicy, QuestionDTO, QuestionDifficulty, QuestionFilter, QuestionType, ResultVisibility } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCheck, CheckSquare, ClipboardCheck, Dices, Layers, Mail, MoreVertical, Pencil, Plus, Search, Sparkles, Tags, Trash2, X } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EditExamQuestionDialog, isExamStarted, QuestionAnswers } from "./ExamQuestionParts";

const PAGE_SIZE = 8;

interface ExamConfigForm {
  startTime: string;
  endTime: string;
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswersAfterExam: boolean;
  passScore: string;
  maxScore: string; // NEW: score scale (blank = 10)
  latePolicy: LatePolicy;
  latePenaltyPercent: string;
  lateGraceMinutes: string;
  resultVisibility: ResultVisibility;
  examType: ExamType;
  accessCode: string;
}

const DEFAULT_CONFIG: ExamConfigForm = {
  startTime: "",
  endTime: "",
  maxAttempts: "1",
  shuffleQuestions: false,
  shuffleOptions: false,
  showAnswersAfterExam: false,
  passScore: "",
  maxScore: "", // NEW
  latePolicy: "NOT_ALLOWED",
  latePenaltyPercent: "",
  lateGraceMinutes: "0",
  resultVisibility: "IMMEDIATE",
  examType: "MIXED",
  accessCode: "",
};

const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  NOT_ALLOWED: "Late submission not allowed",
  ALLOWED_WITH_PENALTY: "Allowed with point penalty",
  ALLOWED: "Allowed with no penalty",
};

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice Only",
  ESSAY: "Essay Only",
  MIXED: "Multiple Choice & Essay",
};

const RESULT_VISIBILITY_LABEL: Record<ResultVisibility, string> = {
  IMMEDIATE: "View immediately after grading",
  AFTER_EXAM_CLOSED: "View after exam closes",
  MANUAL_RELEASE: "Manually released by teacher",
};

const toInputDateTime = (value?: string | null) => (value ? value.slice(0, 16) : "");

const configFromExam = (exam: ExamDTO): ExamConfigForm => ({
  startTime: toInputDateTime(exam.startTime),
  endTime: toInputDateTime(exam.endTime),
  maxAttempts: String(exam.maxAttempts ?? 1),
  shuffleQuestions: exam.shuffleQuestions ?? false,
  shuffleOptions: exam.shuffleOptions ?? false,
  showAnswersAfterExam: exam.showAnswersAfterExam ?? false,
  passScore: exam.passScore != null ? String(exam.passScore) : "",
  maxScore: exam.maxScore != null ? String(exam.maxScore) : "", // NEW
  latePolicy: exam.latePolicy ?? "NOT_ALLOWED",
  latePenaltyPercent: exam.latePenaltyPercent != null ? String(exam.latePenaltyPercent) : "",
  lateGraceMinutes: String(exam.lateGraceMinutes ?? 0),
  resultVisibility: exam.resultVisibility ?? "IMMEDIATE",
  examType: exam.examType ?? "MIXED",
  accessCode: exam.accessCode ?? "",
});

function validateConfig(
    duration: number,
    cfg: ExamConfigForm,
    originalStartTime?: string,
    originalEndTime?: string,
): string | null {
  const now = Date.now() - 60 * 1000;

  if (cfg.startTime) {
    const start = new Date(cfg.startTime).getTime();
    const isStartChanged = !originalStartTime || new Date(originalStartTime).getTime() !== start;
    if (isStartChanged && start < now) {
      return "Start time cannot be in the past.";
    }
  }

  if (cfg.endTime) {
    const end = new Date(cfg.endTime).getTime();
    const isEndChanged = !originalEndTime || new Date(originalEndTime).getTime() !== end;
    if (isEndChanged && end < now) {
      return "End time cannot be in the past.";
    }
  }

  if (cfg.startTime && cfg.endTime) {
    const start = new Date(cfg.startTime).getTime();
    const end = new Date(cfg.endTime).getTime();
    if (start >= end) return "End time must be after start time.";
    const windowMinutes = Math.floor((end - start) / 60000);
    if (duration > windowMinutes) return `Exam duration (${duration} mins) exceeds the available time window (${windowMinutes} mins).`;
  }
  if (!(Number(cfg.maxAttempts) >= 1)) return "Maximum attempts must be at least 1.";
  if (cfg.maxScore !== "" && !(Number(cfg.maxScore) > 0 && Number(cfg.maxScore) <= 1000)) return "Max score must be greater than 0 and at most 1000."; // NEW
  if (cfg.passScore !== "" && Number(cfg.passScore) < 0) return "Passing score must be >= 0.";
  if (cfg.passScore !== "" && Number(cfg.passScore) > (cfg.maxScore !== "" ? Number(cfg.maxScore) : 10)) return "Passing score cannot exceed the max score."; // NEW
  if (cfg.latePolicy !== "NOT_ALLOWED" && !cfg.endTime) return "End time is required when setting a late submission policy.";
  if (cfg.latePolicy === "ALLOWED_WITH_PENALTY") {
    const pct = Number(cfg.latePenaltyPercent);
    if (!(pct >= 1 && pct <= 100)) return "Late penalty percentage must be between 1% and 100%.";
  }
  if (Number(cfg.lateGraceMinutes) < 0) return "Grace period minutes must be >= 0.";
  if (cfg.latePolicy === "NOT_ALLOWED" && Number(cfg.lateGraceMinutes) > 0) return "Grace period can only be set when late submissions are allowed.";
  return null;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
  const data = err?.response?.data;
  const fieldError = data?.errors ? (Object.values(data.errors).flat()[0]) : undefined;
  return fieldError || data?.message || fallback;
};

export default function ExamManagementPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [examSearch, setExamSearch] = useState("");
  const [examPage, setExamPage] = useState(0);
  const [activeExam, setActiveExam] = useState<ExamDTO | null>(null);
  const [editingExam, setEditingExam] = useState<ExamDTO | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [cfg, setCfg] = useState<ExamConfigForm>(DEFAULT_CONFIG);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [questionType, setQuestionType] = useState("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [questionPage, setQuestionPage] = useState(0);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [examToDelete, setExamToDelete] = useState<ExamDTO | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<QuestionDTO | null>(null);
  const [isRandomOpen, setIsRandomOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [randomTopic, setRandomTopic] = useState<string>("");
  const [randomDifficulty, setRandomDifficulty] = useState<string>("ALL");
  const [randomQuestionType, setRandomQuestionType] = useState<string>("ALL");

  const examsQuery = useQuery({
    queryKey: ["exam-management", examPage, examSearch],
    queryFn: () => examApi.getPage({ page: examPage, size: PAGE_SIZE, sort: "createdAt,desc" }, examSearch),
  });

  const lockedQuestionType: QuestionType | null =
      activeExam?.examType === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE"
          : activeExam?.examType === "ESSAY" ? "ESSAY"
              : null;
  const effectiveQuestionType = lockedQuestionType ?? questionType;

  const questionFilter: QuestionFilter = {
    isActive: true,
    ...(effectiveQuestionType !== "ALL" ? { type: effectiveQuestionType as QuestionType } : {}),
    ...(difficulty !== "ALL" ? { difficulty: difficulty as QuestionDifficulty } : {}),
    ...(questionTopic.trim() ? { topic: questionTopic.trim().toLowerCase() } : {}),
  };

  const questionsQuery = useQuery({
    queryKey: ["exam-question-picker", questionPage, questionSearch, effectiveQuestionType, difficulty, questionTopic],
    enabled: isPickerOpen && Boolean(activeExam?.id),
    queryFn: () =>
        questionApi.getPage(
            { page: questionPage, size: PAGE_SIZE, sort: "id,desc" },
            questionSearch,
            questionFilter,
        ),
    placeholderData: (previousData) => previousData,
  });

  const allBankQuestionsQuery = useQuery({
    queryKey: ["exam-question-all-bank", effectiveQuestionType],
    enabled: isPickerOpen && Boolean(activeExam?.id),
    queryFn: () =>
        questionApi.getPage(
            { page: 0, size: 2000, sort: "id,desc" },
            undefined,
            {
              isActive: true,
              ...(effectiveQuestionType !== "ALL" ? { type: effectiveQuestionType as QuestionType } : {}),
            },
        ),
    staleTime: 30_000,
  });

  const refreshExams = () => queryClient.invalidateQueries({ queryKey: ["exam-management"] });

  const saveExamMutation = useMutation({
    mutationFn: () => {
      const request = {
        title: newTitle.trim(),
        durationMinutes: Number(newDuration),
        isActive: editingExam?.isActive ?? true,
        startTime: cfg.startTime || undefined,
        endTime: cfg.endTime || undefined,
        maxAttempts: Number(cfg.maxAttempts),
        shuffleQuestions: cfg.shuffleQuestions,
        shuffleOptions: cfg.shuffleOptions,
        showAnswersAfterExam: cfg.showAnswersAfterExam,
        passScore: cfg.passScore !== "" ? Number(cfg.passScore) : undefined,
        maxScore: cfg.maxScore !== "" ? Number(cfg.maxScore) : undefined, // NEW: blank = backend default 10
        latePolicy: cfg.latePolicy,
        latePenaltyPercent:
            cfg.latePolicy === "ALLOWED_WITH_PENALTY" && cfg.latePenaltyPercent !== ""
                ? Number(cfg.latePenaltyPercent)
                : undefined,
        lateGraceMinutes: Number(cfg.lateGraceMinutes || 0),
        resultVisibility: cfg.resultVisibility,
        examType: cfg.examType,
        accessCode: cfg.accessCode ? cfg.accessCode.trim() : "",
      };
      return editingExam?.id
          ? examApi.update(String(editingExam.id), request)
          : examApi.create(request);
    },
    onSuccess: (exam) => {
      if (editingExam?.id === activeExam?.id) setActiveExam(exam);
      setCreateOpen(false);
      setEditingExam(null);
      setNewTitle("");
      setNewDuration("60");
      setCfg(DEFAULT_CONFIG);
      setExamPage(0);
      void refreshExams();
      toast.success(editingExam ? "Exam updated successfully" : "Exam created successfully");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to save exam")),
  });

  const deleteExamMutation = useMutation({
    mutationFn: (examId: number) => examApi.delete(String(examId)),
    onSuccess: (_, examId) => {
      if (activeExam?.id === examId) {
        setActiveExam(null);
        setPickerOpen(false);
      }
      setExamToDelete(null);
      setDeleteConfirmInput("");
      void refreshExams();
      toast.success("Exam deleted successfully");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to delete exam")),
  });

  const openDeleteConfirm = (exam: ExamDTO) => {
    setExamToDelete(exam);
    setDeleteConfirmInput("");
  };

  const closeDeleteConfirm = () => {
    if (deleteExamMutation.isPending) return;
    setExamToDelete(null);
    setDeleteConfirmInput("");
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmInput !== "DELETE" || !examToDelete?.id || deleteExamMutation.isPending) {
      return;
    }
    deleteExamMutation.mutate(examToDelete.id);
  };

  const addQuestionsMutation = useMutation({
    mutationFn: (overrideIds?: number[]) =>
      examApi.addQuestions(activeExam!.id!, overrideIds ?? [...selectedQuestionIds]),
    onSuccess: (exam) => {
      setActiveExam(exam);
      setSelectedQuestionIds(new Set());
      void refreshExams();
      queryClient.invalidateQueries({ queryKey: ["exam-question-all-bank"] });
      queryClient.invalidateQueries({ queryKey: ["exam-question-picker"] });
      toast.success("Questions added to exam");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to add questions to exam")),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: ({ examId, questionId }: { examId: number; questionId: number }) =>
        examApi.removeQuestion(examId, questionId),
    onSuccess: (exam) => {
      setActiveExam(exam);
      void refreshExams();
      queryClient.invalidateQueries({ queryKey: ["exam-question-all-bank"] });
      queryClient.invalidateQueries({ queryKey: ["exam-question-picker"] });
      toast.success("Question removed from exam");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to remove question from exam")),
  });

  const openQuestionPicker = (exam: ExamDTO) => {
    setActiveExam(exam);
    setQuestionSearch("");
    setQuestionTopic("");
    setQuestionType("ALL");
    setDifficulty("ALL");
    setQuestionPage(0);
    setSelectedQuestionIds(new Set());
    setPickerOpen(true);
  };

  const openEditExam = (exam: ExamDTO) => {
    setEditingExam(exam);
    setNewTitle(exam.title);
    setNewDuration(String(exam.durationMinutes));
    setCfg(configFromExam(exam));
    setCreateOpen(true);
  };

  const toggleQuestion = (questionId: number, checked: boolean) => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (checked) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  };

  const allBankQuestions = useMemo(() => allBankQuestionsQuery.data?.content ?? [], [allBankQuestionsQuery.data?.content]);

  const { topicList, topicCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of allBankQuestions) {
      const t = (q.topic || "").trim();
      if (t) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    const topics = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return { topicList: topics, topicCounts: counts };
  }, [allBankQuestions]);

  const sourceIdsInExam = useMemo(() => {
    const set = new Set<number>();
    (activeExam?.questions ?? []).forEach((q) => {
      if (q.sourceQuestionId != null) set.add(q.sourceQuestionId);
      if (q.id != null) set.add(q.id);
    });
    return set;
  }, [activeExam?.questions]);

  const filterQuestionItem = (q: QuestionDTO) => {
    if (effectiveQuestionType !== "ALL" && q.type !== effectiveQuestionType) return false;
    if (difficulty !== "ALL" && q.difficulty !== difficulty) return false;
    if (questionTopic.trim() && (q.topic || "").trim().toLowerCase() !== questionTopic.trim().toLowerCase()) return false;
    if (questionSearch.trim()) {
      const s = questionSearch.trim().toLowerCase();
      const matchContent = (q.content || "").toLowerCase().includes(s);
      const matchTopic = (q.topic || "").toLowerCase().includes(s);
      if (!matchContent && !matchTopic) return false;
    }
    return true;
  };

  const eligibleFilteredQuestions = useMemo(() => {
    return allBankQuestions.filter((q) => !sourceIdsInExam.has(q.id) && filterQuestionItem(q));
  }, [allBankQuestions, sourceIdsInExam, effectiveQuestionType, difficulty, questionTopic, questionSearch]);

  const eligibleTopicQuestions = useMemo(() => {
    if (!questionTopic.trim()) return [];
    return allBankQuestions.filter(
      (q) => !sourceIdsInExam.has(q.id) && (q.topic || "").trim().toLowerCase() === questionTopic.trim().toLowerCase()
    );
  }, [allBankQuestions, sourceIdsInExam, questionTopic]);

  const allAvailableBankQuestions = useMemo(() => {
    return allBankQuestions.filter((q) => !sourceIdsInExam.has(q.id));
  }, [allBankQuestions, sourceIdsInExam]);

  const selectablePageQuestions = useMemo(() => {
    return (questionsQuery.data?.content ?? []).filter((q) => !sourceIdsInExam.has(q.id));
  }, [questionsQuery.data?.content, sourceIdsInExam]);

  const isAllPageSelected =
    selectablePageQuestions.length > 0 &&
    selectablePageQuestions.every((q) => selectedQuestionIds.has(q.id));

  const isAllFilteredSelected =
    eligibleFilteredQuestions.length > 0 &&
    eligibleFilteredQuestions.every((q) => selectedQuestionIds.has(q.id));

  const isAllTopicSelected =
    eligibleTopicQuestions.length > 0 &&
    eligibleTopicQuestions.every((q) => selectedQuestionIds.has(q.id));

  const handleToggleSelectAllPage = () => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        selectablePageQuestions.forEach((q) => next.delete(q.id));
      } else {
        selectablePageQuestions.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    if (eligibleFilteredQuestions.length === 0) {
      toast.info("No unadded questions matching the current filter.");
      return;
    }
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        eligibleFilteredQuestions.forEach((q) => next.delete(q.id));
        toast.info(`Deselected ${eligibleFilteredQuestions.length} filtered questions.`);
      } else {
        eligibleFilteredQuestions.forEach((q) => next.add(q.id));
        toast.success(`Selected ${eligibleFilteredQuestions.length} questions matching filter.`);
      }
      return next;
    });
  };

  const handleToggleSelectAllInTopic = (topicName: string) => {
    const list = allBankQuestions.filter(
      (q) => !sourceIdsInExam.has(q.id) && (q.topic || "").trim().toLowerCase() === topicName.trim().toLowerCase()
    );
    if (list.length === 0) {
      toast.info(`All questions in topic "${topicName}" are already in this exam.`);
      return;
    }
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (isAllTopicSelected) {
        list.forEach((q) => next.delete(q.id));
        toast.info(`Deselected all questions in topic "${topicName}".`);
      } else {
        list.forEach((q) => next.add(q.id));
        toast.success(`Selected ${list.length} questions from topic "${topicName}".`);
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds(new Set());
    toast.info("Cleared all selected questions.");
  };

  const openRandomDialog = (preferredTopic?: string) => {
    setRandomTopic(preferredTopic || questionTopic || "");
    setRandomDifficulty(difficulty !== "ALL" ? difficulty : "ALL");
    setRandomQuestionType(lockedQuestionType ?? (questionType !== "ALL" ? questionType : "ALL"));
    setIsRandomOpen(true);
  };

  const eligibleForRandom = useMemo(() => {
    return allBankQuestions.filter((q) => {
      if (sourceIdsInExam.has(q.id)) return false;
      const typeToFilter = lockedQuestionType ?? (randomQuestionType !== "ALL" ? randomQuestionType : null);
      if (typeToFilter && q.type !== typeToFilter) return false;
      if (randomDifficulty !== "ALL" && q.difficulty !== randomDifficulty) return false;
      if (randomTopic.trim()) {
        if ((q.topic || "").trim().toLowerCase() !== randomTopic.trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [allBankQuestions, sourceIdsInExam, lockedQuestionType, randomQuestionType, randomDifficulty, randomTopic]);

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
    const pickedIds = shuffled.slice(0, count).map((q) => q.id);

    addQuestionsMutation.mutate(pickedIds, {
      onSuccess: () => {
        setIsRandomOpen(false);
        toast.success(`Added ${pickedIds.length} random question(s) to exam!`);
      },
    });
  };

  const activeExamStarted = isExamStarted(activeExam);
  const examRows = examsQuery.data?.content ?? [];
  const questionRows = questionsQuery.data?.content ?? [];
  const examTotalPages = examsQuery.data?.totalPages ?? 0;
  const questionTotalPages = questionsQuery.data?.totalPages ?? 0;

  return (
      <MainLayout pathName={{ exams: "Exam Management" }}>
        <section className="flex flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-sm text-muted-foreground">Exam Management</p>
              <h1 className="mt-1 text-2xl font-semibold">Exams List</h1>
            </div>
            <Button onClick={() => { setEditingExam(null); setNewTitle(""); setNewDuration("60"); setCfg(DEFAULT_CONFIG); setCreateOpen(true); }}>
              <Plus />
              Create Exam
            </Button>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                  aria-label="Search exams"
                  className="pl-9"
                  placeholder="Search by exam title"
                  value={examSearch}
                  onChange={(event) => {
                    setExamSearch(event.target.value);
                    setExamPage(0);
                  }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
            {examsQuery.data?.totalElements ?? 0} exam(s)
          </span>
          </div>

          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Title</TableHead>
                  <TableHead className="w-32">Duration</TableHead>
                  <TableHead className="w-32">Questions</TableHead>
                  <TableHead className="w-32">Max Score</TableHead> {/* CHANGED: was "Total Points" */}
                  <TableHead className="w-64 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examsQuery.isLoading && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading exams...</TableCell></TableRow>
                )}
                {examsQuery.isError && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Failed to load exams list.</TableCell></TableRow>
                )}
                {!examsQuery.isLoading && !examsQuery.isError && examRows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No matching exams found.</TableCell></TableRow>
                )}
                {examRows.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">
                        <button
                            type="button"
                            className="text-left font-medium hover:underline"
                            onClick={() => exam.id && navigate(`/exams/${exam.id}/grading`)}
                        >
                          {exam.title}
                        </button>
                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {exam.startTime || exam.endTime
                              ? `${exam.startTime ? exam.startTime.replace("T", " ").slice(0, 16) : "…"} → ${exam.endTime ? exam.endTime.replace("T", " ").slice(0, 16) : "…"}`
                              : "No open/close time limits"}
                          {" · "}Max {exam.maxAttempts ?? 1} attempt(s)
                          {" · "}{EXAM_TYPE_LABEL[exam.examType ?? "MIXED"]}
                        </p>
                      </TableCell>
                      <TableCell>{exam.durationMinutes} mins</TableCell>
                      <TableCell>{exam.questionIds?.length ?? exam.questions?.length ?? 0}</TableCell>
                      <TableCell>{exam.maxScore ?? 10}</TableCell> {/* CHANGED */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openQuestionPicker(exam)}>
                            <BookOpen />
                            Questions
                          </Button>
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exam.id && navigate(`/exams/${exam.id}/grading`)}
                              disabled={!exam.id}
                          >
                            <ClipboardCheck className="size-4" />
                            Essay Grading
                          </Button>
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exam.id && navigate(`/exams/${exam.id}/invitations`)}
                              disabled={!exam.id}
                          >
                            <Mail className="size-4" />
                            Invitations
                          </Button>

                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                  exam.id && navigate(`/exams/${exam.id}/result-statistics`)
                              }
                              disabled={!exam.id}
                          >
                            <ClipboardCheck className="size-4" />
                            Statistics
                          </Button>

                          <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit exam"
                              title="Edit exam"
                              onClick={() => openEditExam(exam)}
                          >
                            <Pencil className="size-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="More options"
                                  title="More options"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => openDeleteConfirm(exam)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete Exam
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={examPage === 0} onClick={() => setExamPage((page) => page - 1)}>Previous</Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">{examTotalPages === 0 ? 0 : examPage + 1} / {examTotalPages}</span>
            <Button variant="outline" size="sm" disabled={examPage + 1 >= examTotalPages} onClick={() => setExamPage((page) => page + 1)}>Next</Button>
          </div>
        </section>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const problem = validateConfig(
                      Number(newDuration),
                      cfg,
                      editingExam?.startTime ? toInputDateTime(editingExam.startTime) : undefined,
                      editingExam?.endTime ? toInputDateTime(editingExam.endTime) : undefined,
                  );
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  saveExamMutation.mutate();
                }}
            >
              <DialogHeader>
                <DialogTitle>{editingExam ? "Edit Exam" : "Create Exam"}</DialogTitle>
                <DialogDescription>Configure exam title, duration, and rules.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-5">
                <label className="grid gap-2 text-sm font-medium">
                  Exam Title
                  <Input required maxLength={200} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Duration (minutes)
                  <Input required type="number" min={1} value={newDuration} onChange={(event) => setNewDuration(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Exam Type
                  <Select value={cfg.examType} onValueChange={(value) => setCfg((c) => ({ ...c, examType: value as ExamType }))}>
                    <SelectTrigger aria-label="Exam type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((key) => (
                          <SelectItem key={key} value={key}>{EXAM_TYPE_LABEL[key]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs font-normal text-muted-foreground">
                    Only matching question types can be selected. Changing type with existing invalid questions will be rejected.
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Exam Password / Access Code (leave blank if not required)
                  <Input
                      type="text"
                      placeholder="e.g. EXAM2026"
                      maxLength={100}
                      value={cfg.accessCode}
                      onChange={(event) => setCfg((c) => ({ ...c, accessCode: event.target.value }))}
                  />
                </label>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Start Time
                    <Input
                        type="datetime-local"
                        value={cfg.startTime}
                        onChange={(event) => setCfg((c) => ({ ...c, startTime: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    End Time
                    <Input
                        type="datetime-local"
                        value={cfg.endTime}
                        onChange={(event) => setCfg((c) => ({ ...c, endTime: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Maximum Attempts
                    <Input type="number" min={1} value={cfg.maxAttempts} onChange={(event) => setCfg((c) => ({ ...c, maxAttempts: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Max Score (leave blank = 10)
                    <Input type="number" min={0.01} step="0.01" placeholder="10" value={cfg.maxScore} onChange={(event) => setCfg((c) => ({ ...c, maxScore: event.target.value }))} />
                    <span className="text-xs font-normal text-muted-foreground">
                      Question score = max score × question weight ÷ total weight. {/* NEW */}
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Passing Score (leave blank = no requirement)
                    <Input type="number" min={0} step="0.01" value={cfg.passScore} onChange={(event) => setCfg((c) => ({ ...c, passScore: event.target.value }))} />
                  </label>
                  <div className="grid gap-2 text-sm font-medium">
                    Late Submission Policy
                    <Select value={cfg.latePolicy} onValueChange={(value) => setCfg((c) => ({
                      ...c,
                      latePolicy: value as LatePolicy,
                      lateGraceMinutes: value === "NOT_ALLOWED" ? "0" : c.lateGraceMinutes,
                    }))}>
                      <SelectTrigger aria-label="Late submission policy"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LATE_POLICY_LABEL) as LatePolicy[]).map((key) => (
                            <SelectItem key={key} value={key}>{LATE_POLICY_LABEL[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {cfg.latePolicy === "ALLOWED_WITH_PENALTY" && (
                      <label className="grid gap-2 text-sm font-medium">
                        Late Penalty Percentage (1–100%)
                        <Input type="number" min={1} max={100} value={cfg.latePenaltyPercent} onChange={(event) => setCfg((c) => ({ ...c, latePenaltyPercent: event.target.value }))} />
                      </label>
                  )}
                  {cfg.latePolicy !== "NOT_ALLOWED" && (
                      <label className="grid gap-2 text-sm font-medium">
                        Grace Period (minutes)
                        <Input type="number" min={0} value={cfg.lateGraceMinutes} onChange={(event) => setCfg((c) => ({ ...c, lateGraceMinutes: event.target.value }))} />
                      </label>
                  )}
                  <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Result Visibility
                    <Select value={cfg.resultVisibility} onValueChange={(value) => setCfg((c) => ({ ...c, resultVisibility: value as ResultVisibility }))}>
                      <SelectTrigger aria-label="Result visibility"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RESULT_VISIBILITY_LABEL) as ResultVisibility[]).map((key) => (
                            <SelectItem key={key} value={key}>{RESULT_VISIBILITY_LABEL[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={cfg.shuffleQuestions} onChange={(event) => setCfg((c) => ({ ...c, shuffleQuestions: event.target.checked }))} />
                    Shuffle Questions
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={cfg.shuffleOptions} onChange={(event) => setCfg((c) => ({ ...c, shuffleOptions: event.target.checked }))} />
                    Shuffle Options
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={cfg.showAnswersAfterExam} onChange={(event) => setCfg((c) => ({ ...c, showAnswersAfterExam: event.target.checked }))} />
                    Show Answers After Exam
                  </label>
                  {cfg.showAnswersAfterExam && (
                      <p className="text-xs text-muted-foreground">
                        Students see correct answers only after their score is published and they have no attempts left (or the exam has closed).
                      </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveExamMutation.isPending || !newTitle.trim()}>
                  {saveExamMutation.isPending ? "Saving..." : editingExam ? "Save Changes" : "Create Exam"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isPickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden p-5 sm:max-w-6xl">
            <DialogHeader className="shrink-0">
              <DialogTitle>{activeExam?.title ?? "Select Questions"}</DialogTitle>
              <DialogDescription>
                Search questions by content/topic, filter by type and difficulty, then add them to the exam.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)] lg:overflow-hidden">
              <section className="flex min-h-0 flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative sm:col-span-3">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search questions"
                        className="pl-9"
                        placeholder="Search content or topic..."
                        value={questionSearch}
                        onChange={(event) => {
                          setQuestionSearch(event.target.value);
                          setQuestionPage(0);
                        }}
                    />
                  </div>
                  <Select value={effectiveQuestionType} disabled={lockedQuestionType !== null} onValueChange={(value) => { setQuestionType(value); setQuestionPage(0); }}>
                    <SelectTrigger aria-label="Filter question type"><SelectValue placeholder="Question type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                      <SelectItem value="ESSAY">Essay</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={difficulty} onValueChange={(value) => { setDifficulty(value); setQuestionPage(0); }}>
                    <SelectTrigger aria-label="Filter difficulty"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Difficulties</SelectItem>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HARD">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={questionTopic || "ALL"}
                    onValueChange={(value) => {
                      setQuestionTopic(value === "ALL" ? "" : value);
                      setQuestionPage(0);
                    }}
                  >
                    <SelectTrigger aria-label="Filter topic">
                      <SelectValue placeholder="All Topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Topics ({allBankQuestions.length})</SelectItem>
                      {topicList.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t} ({topicCounts[t] ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic Selector Chips */}
                {topicList.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="shrink-0 text-muted-foreground font-medium flex items-center gap-1">
                      <Tags className="size-3 text-indigo-500" /> Topics:
                    </span>
                    <Badge
                      variant={questionTopic === "" ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => { setQuestionTopic(""); setQuestionPage(0); }}
                    >
                      All ({allBankQuestions.length})
                    </Badge>
                    {topicList.map((t) => (
                      <Badge
                        key={t}
                        variant={questionTopic.toLowerCase() === t.toLowerCase() ? "default" : "secondary"}
                        className="cursor-pointer hover:opacity-80 whitespace-nowrap transition-opacity"
                        onClick={() => {
                          setQuestionTopic(questionTopic.toLowerCase() === t.toLowerCase() ? "" : t);
                          setQuestionPage(0);
                        }}
                      >
                        {t} ({topicCounts[t] ?? 0})
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Quick Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-muted-foreground text-[11px]">Select:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={handleToggleSelectAllPage}
                      disabled={selectablePageQuestions.length === 0}
                    >
                      <CheckSquare className="mr-1 size-3.5" />
                      {isAllPageSelected ? "Deselect Page" : `Page (${selectablePageQuestions.length})`}
                    </Button>

                    {questionTopic.trim() ? (
                      <>
                        <Button
                          type="button"
                          variant={isAllTopicSelected ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleToggleSelectAllInTopic(questionTopic)}
                          disabled={eligibleTopicQuestions.length === 0}
                          title={`Toggle select all questions in topic "${questionTopic}"`}
                        >
                          <Layers className="mr-1 size-3.5" />
                          {isAllTopicSelected
                            ? `Deselect Topic "${questionTopic}"`
                            : `All Topic "${questionTopic}" (${eligibleTopicQuestions.length})`}
                        </Button>

                        {/* Only show filtered button if search/difficulty narrowed it down */}
                        {eligibleFilteredQuestions.length !== eligibleTopicQuestions.length && (
                          <Button
                            type="button"
                            variant={isAllFilteredSelected ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={handleToggleSelectAllFiltered}
                            disabled={eligibleFilteredQuestions.length === 0}
                            title="Select questions matching search/difficulty inside this topic"
                          >
                            <CheckCheck className="mr-1 size-3.5" />
                            {isAllFilteredSelected
                              ? `Deselect Filtered (${eligibleFilteredQuestions.length})`
                              : `Filtered (${eligibleFilteredQuestions.length})`}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant={isAllFilteredSelected ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={handleToggleSelectAllFiltered}
                        disabled={eligibleFilteredQuestions.length === 0}
                        title="Select all unadded questions matching the current filter"
                      >
                        <CheckCheck className="mr-1 size-3.5" />
                        {isAllFilteredSelected
                          ? `Deselect All (${eligibleFilteredQuestions.length})`
                          : `Select All (${eligibleFilteredQuestions.length})`}
                      </Button>
                    )}

                    {selectedQuestionIds.size > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={handleDeselectAll}
                        title="Clear all selections across all pages"
                      >
                        <X className="mr-1 size-3.5" />
                        Deselect All ({selectedQuestionIds.size})
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                      onClick={() => openRandomDialog(questionTopic)}
                      disabled={allAvailableBankQuestions.length === 0}
                    >
                      <Dices className="mr-1 size-3.5" />
                      {questionTopic.trim() ? `Random from "${questionTopic}"...` : "Random Questions..."}
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            aria-label="Select all on this page"
                            checked={isAllPageSelected}
                            disabled={selectablePageQuestions.length === 0}
                            onChange={handleToggleSelectAllPage}
                          />
                        </TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead className="w-24">Difficulty</TableHead>
                        <TableHead className="w-20 text-right">Weight</TableHead> {/* CHANGED: was "Points" */}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questionsQuery.isLoading && (
                          <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading questions...</TableCell></TableRow>
                      )}
                      {questionsQuery.isError && (
                          <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Failed to load questions list.</TableCell></TableRow>
                      )}
                      {!questionsQuery.isLoading && !questionsQuery.isError && questionRows.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No matching questions found.</TableCell></TableRow>
                      )}
                      {questionRows.map((q) => {
                        const added = sourceIdsInExam.has(q.id);
                        const selected = selectedQuestionIds.has(q.id);
                        return (
                            <TableRow key={q.id}>
                              <TableCell className="text-center">
                                <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    disabled={added}
                                    checked={added || selected}
                                    onChange={(e) => toggleQuestion(q.id, e.target.checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <p className="line-clamp-2 text-sm">{q.content}</p>
                                {q.topic && <p className="mt-0.5 text-xs text-muted-foreground">Topic: {q.topic}</p>}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {q.type === "ESSAY" ? "Essay" : "Multiple Choice"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {q.difficulty === "EASY" ? "Easy" : q.difficulty === "MEDIUM" ? "Medium" : "Hard"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{q.points}</TableCell>
                            </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={() => addQuestionsMutation.mutate()}
                        disabled={selectedQuestionIds.size === 0 || addQuestionsMutation.isPending}
                    >
                      <Plus className="mr-1 size-4" />
                      {addQuestionsMutation.isPending ? "Adding..." : `Add ${selectedQuestionIds.size} Selected Question(s)`}
                    </Button>
                    {selectedQuestionIds.size > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={handleDeselectAll}
                      >
                        <X className="mr-1 size-3.5" />
                        Clear selection
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={questionPage === 0} onClick={() => setQuestionPage((p) => p - 1)}>Previous</Button>
                    <span className="text-xs text-muted-foreground">{questionTotalPages === 0 ? 0 : questionPage + 1} / {questionTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={questionPage + 1 >= questionTotalPages} onClick={() => setQuestionPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col gap-3 rounded-md border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Questions in Exam ({activeExam?.questions?.length ?? 0})</h3>
                  <span className="text-xs font-medium text-muted-foreground">Total weight: {activeExam?.totalPoints ?? 0} · Max score: {activeExam?.maxScore ?? 10}</span> {/* CHANGED */}
                </div>

                {activeExamStarted && (
                    <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                      Exam has started. Removing questions is disabled to protect student results.
                    </p>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
                  {(activeExam?.questions ?? []).length === 0 && (
                      <p className="p-4 text-center text-xs text-muted-foreground">No questions added to this exam yet.</p>
                  )}
                  {(activeExam?.questions ?? []).map((q, idx) => (
                      <div key={q.id} className="rounded-md border bg-background p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-primary">Question {idx + 1} (weight {q.points})</span>
                          <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Edit question points/content"
                                title="Edit question points/content"
                                onClick={() => setEditingQuestion(q)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                disabled={activeExamStarted || removeQuestionMutation.isPending}
                                aria-label="Remove question from exam"
                                title="Remove question from exam"
                                onClick={() => activeExam?.id && removeQuestionMutation.mutate({ examId: activeExam.id, questionId: q.id })}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs">{q.content}</p>
                        <QuestionAnswers question={q} />
                      </div>
                  ))}
                </div>
              </section>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Add Random Questions */}
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
                      <SelectItem value="ESSAY">Essay</SelectItem>
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

        <Dialog open={Boolean(examToDelete)} onOpenChange={(open: boolean) => { if (!open) closeDeleteConfirm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">Confirm Exam Deletion</DialogTitle>
              <DialogDescription>
                This action cannot be undone. All attempts and data related to exam <strong className="text-foreground">{examToDelete?.title}</strong> will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3">
              <p className="text-xs text-muted-foreground">
                Type <strong className="text-foreground">DELETE</strong> below to confirm:
              </p>
              <Input
                  autoFocus
                  placeholder="Type DELETE"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDeleteConfirm} disabled={deleteExamMutation.isPending}>
                Cancel
              </Button>
              <Button
                  variant="destructive"
                  disabled={deleteConfirmInput !== "DELETE" || deleteExamMutation.isPending}
                  onClick={handleConfirmDelete}
              >
                {deleteExamMutation.isPending ? "Deleting..." : "Delete Exam"}
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
                  void refreshExams();
                }}
            />
        )}
      </MainLayout>
  );
}