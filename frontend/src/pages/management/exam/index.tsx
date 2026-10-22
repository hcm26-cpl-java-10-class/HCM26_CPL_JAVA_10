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
import { BookOpen, ClipboardCheck, Mail, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
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
  passScore: string;
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
  passScore: "",
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
  passScore: exam.passScore != null ? String(exam.passScore) : "",
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
  if (cfg.passScore !== "" && Number(cfg.passScore) < 0) return "Passing score must be >= 0.";
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
        passScore: cfg.passScore !== "" ? Number(cfg.passScore) : undefined,
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
    mutationFn: () => examApi.addQuestions(activeExam!.id!, [...selectedQuestionIds]),
    onSuccess: (exam) => {
      setActiveExam(exam);
      setSelectedQuestionIds(new Set());
      void refreshExams();
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

  const sourceIdsInExam = new Set(
      (activeExam?.questions ?? []).map((question) => question.sourceQuestionId).filter((id): id is number => id != null),
  );

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
                  <TableHead className="w-32">Total Points</TableHead>
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
                      <TableCell>{exam.totalPoints ?? 0}</TableCell>
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
                          <Button variant="ghost" size="icon-sm" aria-label="Edit exam" title="Edit exam" onClick={() => openEditExam(exam)}>
                            <Pencil />
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
                    Passing Score (leave blank = no requirement)
                    <Input type="number" min={0} value={cfg.passScore} onChange={(event) => setCfg((c) => ({ ...c, passScore: event.target.value }))} />
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative sm:col-span-2">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search questions"
                        className="pl-9"
                        placeholder="Search content or topic"
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
                  <Input
                      aria-label="Filter topic"
                      className="sm:col-span-2"
                      placeholder="Filter exactly by topic"
                      value={questionTopic}
                      onChange={(event) => {
                        setQuestionTopic(event.target.value);
                        setQuestionPage(0);
                      }}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">Select</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead className="w-24">Difficulty</TableHead>
                        <TableHead className="w-20 text-right">Points</TableHead>
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
                  <Button
                      size="sm"
                      onClick={() => addQuestionsMutation.mutate()}
                      disabled={selectedQuestionIds.size === 0 || addQuestionsMutation.isPending}
                  >
                    <Plus className="mr-1 size-4" />
                    {addQuestionsMutation.isPending ? "Adding..." : `Add ${selectedQuestionIds.size} Selected Question(s)`}
                  </Button>
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
                  <span className="text-xs font-medium text-muted-foreground">Total: {activeExam?.totalPoints ?? 0} pts</span>
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
                          <span className="text-xs font-semibold text-primary">Question {idx + 1} ({q.points} pts)</span>
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