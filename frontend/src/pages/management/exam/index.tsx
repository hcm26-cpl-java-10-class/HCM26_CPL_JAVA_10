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
import type { ExamDTO, LatePolicy, QuestionDTO, QuestionDifficulty, QuestionFilter, QuestionType, ResultVisibility } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardCheck, Mail, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EditExamQuestionDialog, isExamStarted, QuestionAnswers } from "./ExamQuestionParts";

const PAGE_SIZE = 8;

// ===== Cấu hình kỳ thi (UFR-EXM-002) =====
interface ExamConfigForm {
  startTime: string; // datetime-local: "YYYY-MM-DDTHH:mm" hoặc ""
  endTime: string;
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passScore: string;
  latePolicy: LatePolicy;
  latePenaltyPercent: string;
  lateGraceMinutes: string;
  resultVisibility: ResultVisibility;
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
  accessCode: "",
};

const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  NOT_ALLOWED: "Không cho nộp muộn",
  ALLOWED_WITH_PENALTY: "Cho nộp muộn, trừ điểm",
  ALLOWED: "Cho nộp muộn, không trừ điểm",
};

const RESULT_VISIBILITY_LABEL: Record<ResultVisibility, string> = {
  IMMEDIATE: "Xem ngay sau khi chấm",
  AFTER_EXAM_CLOSED: "Xem sau khi kỳ thi đóng",
  MANUAL_RELEASE: "Giáo viên công bố thủ công",
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
  accessCode: exam.accessCode ?? "",
});

function validateConfig(duration: number, cfg: ExamConfigForm): string | null {
  if (cfg.startTime && cfg.endTime) {
    const start = new Date(cfg.startTime).getTime();
    const end = new Date(cfg.endTime).getTime();
    if (start >= end) return "Thời gian đóng phải sau thời gian mở.";
    const windowMinutes = Math.floor((end - start) / 60000);
    if (duration > windowMinutes) return `Thời lượng làm bài (${duration} phút) vượt quá khoảng mở-đóng (${windowMinutes} phút).`;
  }
  if (!(Number(cfg.maxAttempts) >= 1)) return "Số lần làm tối đa phải >= 1.";
  if (cfg.passScore !== "" && Number(cfg.passScore) < 0) return "Điểm đạt phải >= 0.";
  if (cfg.latePolicy !== "NOT_ALLOWED" && !cfg.endTime) return "Cần đặt thời gian đóng để áp dụng chính sách nộp muộn.";
  if (cfg.latePolicy === "ALLOWED_WITH_PENALTY") {
    const pct = Number(cfg.latePenaltyPercent);
    if (!(pct >= 1 && pct <= 100)) return "Nộp muộn có trừ điểm cần phần trăm trừ từ 1 đến 100.";
  }
  if (Number(cfg.lateGraceMinutes) < 0) return "Thời gian gia hạn phải >= 0 phút.";
  if (cfg.latePolicy === "NOT_ALLOWED" && Number(cfg.lateGraceMinutes) > 0) return "Chỉ đặt gia hạn khi cho phép nộp muộn.";
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

  const questionFilter: QuestionFilter = {
    isActive: true,
    ...(questionType !== "ALL" ? { type: questionType as QuestionType } : {}),
    ...(difficulty !== "ALL" ? { difficulty: difficulty as QuestionDifficulty } : {}),
    ...(questionTopic.trim() ? { topic: questionTopic.trim().toLowerCase() } : {}),
  };

  const questionsQuery = useQuery({
    queryKey: ["exam-question-picker", questionPage, questionSearch, questionType, difficulty, questionTopic],
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
      refreshExams();
      toast.success(editingExam ? "Đã cập nhật đề thi" : "Đã tạo đề thi");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Không thể lưu đề thi")),
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
      refreshExams();
      toast.success("Đã xóa đề thi");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Không thể xóa đề thi")),
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
      refreshExams();
      toast.success("Đã thêm câu hỏi vào đề");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Không thể thêm câu hỏi vào đề")),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: ({ examId, questionId }: { examId: number; questionId: number }) =>
        examApi.removeQuestion(examId, questionId),
    onSuccess: (exam) => {
      setActiveExam(exam);
      refreshExams();
      toast.success("Đã gỡ câu hỏi khỏi đề");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Không thể gỡ câu hỏi khỏi đề")),
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
      <MainLayout pathName={{ exams: "Quản lý đề thi" }}>
        <section className="flex flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-sm text-muted-foreground">Exam management</p>
              <h1 className="mt-1 text-2xl font-semibold">Quản lý đề thi</h1>
            </div>
            <Button onClick={() => { setEditingExam(null); setNewTitle(""); setNewDuration("60"); setCfg(DEFAULT_CONFIG); setCreateOpen(true); }}>
              <Plus />
              Tạo đề thi
            </Button>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                  aria-label="Tìm đề thi"
                  className="pl-9"
                  placeholder="Tìm theo tên đề thi"
                  value={examSearch}
                  onChange={(event) => {
                    setExamSearch(event.target.value);
                    setExamPage(0);
                  }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
            {examsQuery.data?.totalElements ?? 0} đề thi
          </span>
          </div>

          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên đề thi</TableHead>
                  <TableHead className="w-32">Thời lượng</TableHead>
                  <TableHead className="w-32">Số câu</TableHead>
                  <TableHead className="w-32">Tổng điểm</TableHead>
                  <TableHead className="w-64 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examsQuery.isLoading && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Đang tải đề thi...</TableCell></TableRow>
                )}
                {examsQuery.isError && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Không tải được danh sách đề thi.</TableCell></TableRow>
                )}
                {!examsQuery.isLoading && !examsQuery.isError && examRows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Chưa có đề thi phù hợp.</TableCell></TableRow>
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
                              : "Không giới hạn thời gian mở/đóng"}
                          {" · "}tối đa {exam.maxAttempts ?? 1} lần
                        </p>
                      </TableCell>
                      <TableCell>{exam.durationMinutes} phút</TableCell>
                      <TableCell>{exam.questionIds?.length ?? exam.questions?.length ?? 0}</TableCell>
                      <TableCell>{exam.totalPoints ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openQuestionPicker(exam)}>
                            <BookOpen />
                            Câu hỏi
                          </Button>
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exam.id && navigate(`/exams/${exam.id}/grading`)}
                              disabled={!exam.id}
                          >
                            <ClipboardCheck className="size-4" />
                            Bài tự luận
                          </Button>
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exam.id && navigate(`/exams/${exam.id}/invitations`)}
                              disabled={!exam.id}
                          >
                            <Mail className="size-4" />
                            Lời mời
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Sửa đề thi" title="Sửa đề thi" onClick={() => openEditExam(exam)}>
                            <Pencil />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Thao tác khác"
                                  title="Thao tác khác"
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
                                Xóa đề thi
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
            <Button variant="outline" size="sm" disabled={examPage === 0} onClick={() => setExamPage((page) => page - 1)}>Trước</Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">{examTotalPages === 0 ? 0 : examPage + 1} / {examTotalPages}</span>
            <Button variant="outline" size="sm" disabled={examPage + 1 >= examTotalPages} onClick={() => setExamPage((page) => page + 1)}>Sau</Button>
          </div>
        </section>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const problem = validateConfig(Number(newDuration), cfg);
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  saveExamMutation.mutate();
                }}
            >
              <DialogHeader>
                <DialogTitle>{editingExam ? "Sửa đề thi" : "Tạo đề thi"}</DialogTitle>
                <DialogDescription>Thiết lập tên đề, thời lượng và cấu hình kỳ thi.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-5">
                <label className="grid gap-2 text-sm font-medium">
                  Tên đề thi
                  <Input required maxLength={200} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Thời lượng (phút)
                  <Input required type="number" min={1} value={newDuration} onChange={(event) => setNewDuration(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Mật khẩu đề thi (để trống nếu không yêu cầu)
                  <Input
                      type="text"
                      placeholder="Ví dụ: THI2026"
                      maxLength={100}
                      value={cfg.accessCode}
                      onChange={(event) => setCfg((c) => ({ ...c, accessCode: event.target.value }))}
                  />
                </label>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Thời gian mở
                    <Input type="datetime-local" value={cfg.startTime} onChange={(event) => setCfg((c) => ({ ...c, startTime: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Thời gian đóng
                    <Input type="datetime-local" value={cfg.endTime} onChange={(event) => setCfg((c) => ({ ...c, endTime: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Số lần làm tối đa
                    <Input type="number" min={1} value={cfg.maxAttempts} onChange={(event) => setCfg((c) => ({ ...c, maxAttempts: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Điểm đạt (để trống = không đặt)
                    <Input type="number" min={0} value={cfg.passScore} onChange={(event) => setCfg((c) => ({ ...c, passScore: event.target.value }))} />
                  </label>
                  <div className="grid gap-2 text-sm font-medium">
                    Chính sách nộp muộn
                    <Select value={cfg.latePolicy} onValueChange={(value) => setCfg((c) => ({
                      ...c,
                      latePolicy: value as LatePolicy,
                      lateGraceMinutes: value === "NOT_ALLOWED" ? "0" : c.lateGraceMinutes,
                    }))}>
                      <SelectTrigger aria-label="Chính sách nộp muộn"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LATE_POLICY_LABEL) as LatePolicy[]).map((key) => (
                            <SelectItem key={key} value={key}>{LATE_POLICY_LABEL[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {cfg.latePolicy === "ALLOWED_WITH_PENALTY" && (
                      <label className="grid gap-2 text-sm font-medium">
                        % điểm bị trừ khi nộp muộn (1–100)
                        <Input type="number" min={1} max={100} value={cfg.latePenaltyPercent} onChange={(event) => setCfg((c) => ({ ...c, latePenaltyPercent: event.target.value }))} />
                      </label>
                  )}
                  {cfg.latePolicy !== "NOT_ALLOWED" && (
                      <label className="grid gap-2 text-sm font-medium">
                        Thời gian gia hạn (phút)
                        <Input type="number" min={0} value={cfg.lateGraceMinutes} onChange={(event) => setCfg((c) => ({ ...c, lateGraceMinutes: event.target.value }))} />
                      </label>
                  )}
                  <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Khi nào sinh viên xem được kết quả
                    <Select value={cfg.resultVisibility} onValueChange={(value) => setCfg((c) => ({ ...c, resultVisibility: value as ResultVisibility }))}>
                      <SelectTrigger aria-label="Hiển thị kết quả"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RESULT_VISIBILITY_LABEL) as ResultVisibility[]).map((key) => (
                            <SelectItem key={key} value={key}>{RESULT_VISIBILITY_LABEL[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={cfg.shuffleQuestions} onChange={(event) => setCfg((c) => ({ ...c, shuffleQuestions: event.target.checked }))} />
                    Xáo trộn thứ tự câu hỏi
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-primary" checked={cfg.shuffleOptions} onChange={(event) => setCfg((c) => ({ ...c, shuffleOptions: event.target.checked }))} />
                    Xáo trộn thứ tự đáp án
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={saveExamMutation.isPending || !newTitle.trim()}>
                  {saveExamMutation.isPending ? "Đang lưu..." : editingExam ? "Lưu thay đổi" : "Tạo đề"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isPickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden p-5 sm:max-w-6xl">
            <DialogHeader className="shrink-0">
              <DialogTitle>{activeExam?.title ?? "Chọn câu hỏi"}</DialogTitle>
              <DialogDescription>
                Tìm câu hỏi theo nội dung/chủ đề, lọc theo loại và độ khó, sau đó thêm vào đề.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)] lg:overflow-hidden">
              <section className="flex min-h-0 flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative sm:col-span-2">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Tìm câu hỏi"
                        className="pl-9"
                        placeholder="Tìm nội dung hoặc chủ đề"
                        value={questionSearch}
                        onChange={(event) => {
                          setQuestionSearch(event.target.value);
                          setQuestionPage(0);
                        }}
                    />
                  </div>
                  <Select value={questionType} onValueChange={(value) => { setQuestionType(value); setQuestionPage(0); }}>
                    <SelectTrigger aria-label="Lọc loại câu hỏi"><SelectValue placeholder="Loại câu hỏi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả loại</SelectItem>
                      <SelectItem value="MULTIPLE_CHOICE">Trắc nghiệm</SelectItem>
                      <SelectItem value="SINGLE_CHOICE">Một đáp án</SelectItem>
                      <SelectItem value="MULTI_CHOICE">Nhiều đáp án</SelectItem>
                      <SelectItem value="ESSAY">Tự luận</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={difficulty} onValueChange={(value) => { setDifficulty(value); setQuestionPage(0); }}>
                    <SelectTrigger aria-label="Lọc độ khó"><SelectValue placeholder="Độ khó" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả độ khó</SelectItem>
                      <SelectItem value="EASY">Dễ</SelectItem>
                      <SelectItem value="MEDIUM">Trung bình</SelectItem>
                      <SelectItem value="HARD">Khó</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                      aria-label="Lọc chủ đề"
                      className="sm:col-span-2"
                      placeholder="Lọc chính xác theo chủ đề"
                      value={questionTopic}
                      onChange={(event) => {
                        setQuestionTopic(event.target.value);
                        setQuestionPage(0);
                      }}
                  />
                </div>

                <div className="min-h-56 flex-1 overflow-y-auto rounded-md border">
                  {questionsQuery.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Đang tìm câu hỏi...</p>}
                  {questionsQuery.isError && <p className="p-6 text-center text-sm text-destructive">Không tải được câu hỏi.</p>}
                  {!questionsQuery.isLoading && !questionsQuery.isError && questionRows.length === 0 && (
                      <p className="p-6 text-center text-sm text-muted-foreground">Không tìm thấy câu hỏi phù hợp.</p>
                  )}
                  <div className="divide-y">
                    {questionRows.map((question) => {
                      const alreadyAdded = sourceIdsInExam.has(question.id);
                      const checked = alreadyAdded || selectedQuestionIds.has(question.id);
                      return (
                          <label key={question.id} className="flex cursor-pointer gap-3 p-3 hover:bg-muted/50 has-[:disabled]:cursor-not-allowed">
                            <input
                                className="mt-1 size-4 accent-primary"
                                type="checkbox"
                                checked={checked}
                                disabled={alreadyAdded}
                                onChange={(event) => toggleQuestion(question.id, event.target.checked)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium leading-5">{question.content}</span>
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                <Badge variant="secondary">{question.type}</Badge>
                                <Badge variant="outline">{question.difficulty}</Badge>
                                {question.topic && <Badge variant="outline">{question.topic}</Badge>}
                              </span>
                            </span>
                          </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 shrink-0">
                  <Button
                      size="sm"
                      disabled={selectedQuestionIds.size === 0 || addQuestionsMutation.isPending}
                      onClick={() => addQuestionsMutation.mutate()}
                  >
                    {addQuestionsMutation.isPending ? "Đang thêm..." : `Thêm (${selectedQuestionIds.size}) câu đã chọn`}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={questionPage === 0} onClick={() => setQuestionPage((page) => page - 1)}>Trước</Button>
                    <span className="text-xs text-muted-foreground">{questionTotalPages === 0 ? 0 : questionPage + 1} / {questionTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={questionPage + 1 >= questionTotalPages} onClick={() => setQuestionPage((page) => page + 1)}>Sau</Button>
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col gap-3 rounded-md border p-3 bg-muted/20">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-semibold">Câu hỏi trong đề ({activeExam?.questions?.length ?? 0})</h3>
                  {activeExamStarted && <Badge variant="destructive" className="text-[10px]">Đang/Đã diễn ra</Badge>}
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {(activeExam?.questions ?? []).length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted-foreground">Chưa có câu hỏi nào trong đề thi này.</p>
                  ) : (
                      (activeExam?.questions ?? []).map((q) => (
                          <div key={q.id} className="py-2.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-medium leading-tight">{q.content}</span>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Sửa bản sao câu hỏi"
                                    disabled={activeExamStarted}
                                    onClick={() => setEditingQuestion(q)}
                                >
                                  <Pencil className="size-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Gỡ khỏi đề thi"
                                    disabled={activeExamStarted || removeQuestionMutation.isPending}
                                    onClick={() => activeExam?.id && removeQuestionMutation.mutate({ examId: activeExam.id, questionId: q.id })}
                                >
                                  <Trash2 className="size-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <QuestionAnswers question={q} />
                          </div>
                      ))
                  )}
                </div>
              </section>
            </div>
          </DialogContent>
        </Dialog>

        {editingQuestion && activeExam && (
            <EditExamQuestionDialog
                exam={activeExam}
                question={editingQuestion}
                onClose={() => setEditingQuestion(null)}
                onSaved={(updatedExam: ExamDTO) => {
                  setActiveExam(updatedExam);
                  refreshExams();
                  setEditingQuestion(null);
                }}
            />
        )}

        <Dialog open={Boolean(examToDelete)} onOpenChange={(open: boolean) => { if (!open) closeDeleteConfirm(); }}>
          <DialogContent aria-describedby="delete-exam-description">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa đề thi</DialogTitle>
              <DialogDescription id="delete-exam-description">
                Hành động này sẽ xóa vĩnh viễn đề thi “{examToDelete?.title}”. Hãy nhập <strong className="text-foreground">DELETE</strong> để xác nhận.
              </DialogDescription>
            </DialogHeader>
            <Input
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="Nhập DELETE"
            />
            <DialogFooter>
              <Button variant="outline" onClick={closeDeleteConfirm}>Hủy</Button>

              <Button
                  variant="destructive"
                  disabled={deleteConfirmInput !== "DELETE" || deleteExamMutation.isPending}
                  onClick={handleConfirmDelete}
              >
                {deleteExamMutation.isPending ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainLayout>
  );
}