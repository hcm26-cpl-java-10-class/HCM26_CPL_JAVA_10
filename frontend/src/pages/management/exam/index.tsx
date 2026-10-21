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
import type { ExamDTO, QuestionDifficulty, QuestionFilter, QuestionType } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 8;

export default function ExamManagementPage() {
  const queryClient = useQueryClient();
  const [examSearch, setExamSearch] = useState("");
  const [examPage, setExamPage] = useState(0);
  const [activeExam, setActiveExam] = useState<ExamDTO | null>(null);
  const [editingExam, setEditingExam] = useState<ExamDTO | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [questionType, setQuestionType] = useState("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [questionPage, setQuestionPage] = useState(0);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());

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
      setExamPage(0);
      refreshExams();
      toast.success(editingExam ? "Đã cập nhật đề thi" : "Đã tạo đề thi");
    },
    onError: () => toast.error("Không thể lưu đề thi"),
  });

  const deleteExamMutation = useMutation({
    mutationFn: (examId: number) => examApi.delete(String(examId)),
    onSuccess: (_, examId) => {
      if (activeExam?.id === examId) {
        setActiveExam(null);
        setPickerOpen(false);
      }
      refreshExams();
      toast.success("Đã xóa đề thi");
    },
    onError: () => toast.error("Không thể xóa đề thi"),
  });

  const addQuestionsMutation = useMutation({
    mutationFn: () => examApi.addQuestions(activeExam!.id!, [...selectedQuestionIds]),
    onSuccess: (exam) => {
      setActiveExam(exam);
      setSelectedQuestionIds(new Set());
      refreshExams();
      toast.success("Đã thêm câu hỏi vào đề");
    },
    onError: () => toast.error("Không thể thêm câu hỏi vào đề"),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: ({ examId, questionId }: { examId: number; questionId: number }) =>
      examApi.removeQuestion(examId, questionId),
    onSuccess: (exam) => {
      setActiveExam(exam);
      refreshExams();
      toast.success("Đã gỡ câu hỏi khỏi đề");
    },
    onError: () => toast.error("Không thể gỡ câu hỏi khỏi đề"),
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

  const questionIdsInExam = new Set(activeExam?.questionIds ?? activeExam?.questions?.map((question) => question.id) ?? []);
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
          <Button onClick={() => { setEditingExam(null); setNewTitle(""); setNewDuration("60"); setCreateOpen(true); }}>
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
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell>{exam.durationMinutes} phút</TableCell>
                  <TableCell>{exam.questionIds?.length ?? exam.questions?.length ?? 0}</TableCell>
                  <TableCell>{exam.totalPoints ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openQuestionPicker(exam)}>
                        <BookOpen />
                        Câu hỏi
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Sửa đề thi" title="Sửa đề thi" onClick={() => openEditExam(exam)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Xóa đề thi"
                        title="Xóa đề thi"
                        disabled={deleteExamMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Xóa đề thi “${exam.title}”?`)) deleteExamMutation.mutate(exam.id!);
                        }}
                      >
                        <Trash2 />
                      </Button>
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
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveExamMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingExam ? "Sửa đề thi" : "Tạo đề thi"}</DialogTitle>
              <DialogDescription>Thiết lập tên đề và thời lượng làm bài.</DialogDescription>
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
                    <SelectItem value="SINGLE_CHOICE">Một đáp án</SelectItem>
                    <SelectItem value="MULTI_CHOICE">Nhiều đáp án</SelectItem>
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
                    const alreadyAdded = questionIdsInExam.has(question.id);
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
                            <Badge variant="secondary">{question.topic || "Chưa phân loại"}</Badge>
                            <Badge variant="outline">{question.difficulty}</Badge>
                            <Badge variant="outline">{question.points} điểm</Badge>
                            {alreadyAdded && <Badge>Đã có trong đề</Badge>}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{questionsQuery.data?.totalElements ?? 0} câu hỏi</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={questionPage === 0} onClick={() => setQuestionPage((page) => page - 1)}>Trước</Button>
                  <span className="min-w-16 text-center text-xs text-muted-foreground">{questionTotalPages === 0 ? 0 : questionPage + 1} / {questionTotalPages}</span>
                  <Button variant="outline" size="sm" disabled={questionPage + 1 >= questionTotalPages} onClick={() => setQuestionPage((page) => page + 1)}>Sau</Button>
                </div>
              </div>
            </section>

            <section className="flex min-h-48 flex-col rounded-md border lg:min-h-0">
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <div>
                  <h2 className="text-sm font-semibold">Câu hỏi trong đề</h2>
                  <p className="text-xs text-muted-foreground">
                    {(activeExam?.questions?.length ?? 0)} câu · {activeExam?.totalPoints ?? 0} điểm
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!selectedQuestionIds.size || addQuestionsMutation.isPending}
                  onClick={() => addQuestionsMutation.mutate()}
                >
                  <Plus />
                  Thêm {selectedQuestionIds.size || ""}
                </Button>
              </div>
              <div className="min-h-0 flex-1 divide-y overflow-y-auto">
                {activeExam?.questions?.map((question) => (
                  <div key={question.id} className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 text-sm">{question.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{question.points} điểm · {question.topic || "Chưa phân loại"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Gỡ câu hỏi khỏi đề"
                      title="Gỡ câu hỏi khỏi đề"
                      disabled={removeQuestionMutation.isPending}
                      onClick={() => removeQuestionMutation.mutate({ examId: activeExam.id!, questionId: question.id })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {!activeExam?.questions?.length && (
                  <p className="p-5 text-center text-sm text-muted-foreground">Đề chưa có câu hỏi.</p>
                )}
              </div>
            </section>
          </div>

          <div className="flex shrink-0 justify-end border-t pt-3">
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              <X />
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}