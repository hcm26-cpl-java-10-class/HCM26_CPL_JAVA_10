import { examApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXAM_CATEGORY_LABEL, type ExamCategory, type ExamDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, CalendarClock, ClipboardCheck, Clock, ListChecks, Plus, Search, Trophy, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExamConfigFields } from "./ExamConfigFields";
import {
  buildExamRequest,
  DEFAULT_CONFIG,
  EXAM_CATEGORY_OPTIONS,
  EXAM_TYPE_LABEL,
  getErrorMessage,
  getFutureDatetimeString,
  validateConfig,
  type ExamConfigForm,
} from "./examConfig";

/** 3 cards per row x 3 rows. */
const PAGE_SIZE = 9;

type ExamStatus = "UPCOMING" | "OPEN" | "CLOSED";

const examStatus = (exam: ExamDTO): ExamStatus => {
  const now = Date.now();
  if (exam.endTime && new Date(exam.endTime).getTime() < now) return "CLOSED";
  if (exam.startTime && new Date(exam.startTime).getTime() > now) return "UPCOMING";
  return "OPEN";
};

const STATUS_STYLE: Record<ExamStatus, { label: string; className: string }> = {
  UPCOMING: { label: "Upcoming", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  OPEN: { label: "Open", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt,desc", label: "Newest first" },
  { value: "createdAt,asc", label: "Oldest first" },
  { value: "title,asc", label: "Title A–Z" },
  { value: "startTime,desc", label: "Exam start time" },
];

const formatDateTime = (value?: string | null) =>
  value ? value.replace("T", " ").slice(0, 16) : "—";

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto truncate font-medium">{value}</span>
    </div>
  );
}

export default function ExamManagementPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [examSearch, setExamSearch] = useState("");
  const [examCategoryFilter, setExamCategoryFilter] = useState<ExamCategory | "ALL">("ALL");
  const [examPage, setExamPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState("createdAt,desc");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [cfg, setCfg] = useState<ExamConfigForm>(DEFAULT_CONFIG);

  // The status is worked out from the open/close time, so when it is filtered we load all exams
  // (a teacher has few) and filter / page them here.
  const clientFiltering = statusFilter !== "ALL";
  const examsQuery = useQuery({
    queryKey: ["exam-management", clientFiltering ? 0 : examPage, examSearch, examCategoryFilter, sortKey, clientFiltering],
    queryFn: () => examApi.getPage(
        { page: clientFiltering ? 0 : examPage, size: clientFiltering ? 500 : PAGE_SIZE, sort: sortKey },
        examSearch,
        examCategoryFilter === "ALL" ? undefined : { category: examCategoryFilter },
    ),
  });

  const createExamMutation = useMutation({
    mutationFn: () => examApi.create(buildExamRequest(newTitle, newDuration, cfg, true)),
    onSuccess: () => {
      setCreateOpen(false);
      setNewTitle("");
      setNewDuration("60");
      setCfg(DEFAULT_CONFIG);
      setExamPage(0);
      void queryClient.invalidateQueries({ queryKey: ["exam-management"] });
      toast.success("Exam created successfully");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to save exam")),
  });

  const loadedRows = examsQuery.data?.content ?? [];
  const statusRows = clientFiltering ? loadedRows.filter((exam) => examStatus(exam) === statusFilter) : loadedRows;
  const examRows = clientFiltering ? statusRows.slice(examPage * PAGE_SIZE, (examPage + 1) * PAGE_SIZE) : statusRows;
  const examTotalPages = clientFiltering ? Math.ceil(statusRows.length / PAGE_SIZE) : examsQuery.data?.totalPages ?? 0;
  const examTotal = clientFiltering ? statusRows.length : examsQuery.data?.totalElements ?? 0;
  const hasFilters = examSearch !== "" || examCategoryFilter !== "ALL" || statusFilter !== "ALL";

  const openCreateDialog = () => {
    setNewTitle("");
    setNewDuration("60");
    setCfg({ ...DEFAULT_CONFIG, startTime: getFutureDatetimeString(2) });
    setCreateOpen(true);
  };

  return (
      <MainLayout pathName={{ exams: "Exam Management" }}>
        <section className="flex flex-col gap-5">

          <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-sm text-muted-foreground">Exam Management</p>
              <h1 className="mt-1 text-2xl font-semibold">Exams List</h1>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 size-4" />
                Create Exam
              </Button>

              <Button
                  variant="outline"
                  onClick={() => navigate("/management/exam/templates")}
              >
                <BookmarkPlus className="mr-2 size-4" />
                Use Template
              </Button>
            </div>
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
            <Select value={examCategoryFilter} onValueChange={(value) => {
              setExamCategoryFilter(value as ExamCategory | "ALL");
              setExamPage(0);
            }}>
              <SelectTrigger aria-label="Filter by exam category" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {EXAM_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>{EXAM_CATEGORY_LABEL[category]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value as ExamStatus | "ALL");
              setExamPage(0);
            }}>
              <SelectTrigger aria-label="Filter by status" className="w-full max-w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="UPCOMING">Upcoming</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(value) => {
              setSortKey(value);
              setExamPage(0);
            }}>
              <SelectTrigger aria-label="Sort exams" className="w-full max-w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {examTotal} exam(s)
            </span>
          </div>

          {examsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading exams">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="grid gap-2 border-t pt-3">
                    {Array.from({ length: 5 }, (_, k) => <Skeleton key={k} className="h-4 w-full" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : examsQuery.isError ? (
            <p className="py-16 text-center text-sm text-destructive">Failed to load exams list.</p>
          ) : examRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "No exams match your filters." : "You have no exams yet."}
              </p>
              {hasFilters ? (
                <Button variant="outline" size="sm" onClick={() => {
                  setExamSearch("");
                  setExamCategoryFilter("ALL");
                  setStatusFilter("ALL");
                  setExamPage(0);
                }}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="mr-2 size-4" />
                  Create your first exam
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {examRows.map((exam) => {
                const status = STATUS_STYLE[examStatus(exam)];
                return (
                  // A real link that opens the exam in a new browser tab (middle click and Ctrl+click also work).
                  <a
                    key={exam.id}
                    href={`/exams/${exam.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open exam ${exam.title} in a new tab`}
                    className="flex cursor-pointer flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 break-words text-base font-semibold leading-snug">{exam.title}</h2>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        {(exam.pendingGradingCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <ClipboardCheck className="size-3" />
                            {exam.pendingGradingCount} to grade
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {EXAM_CATEGORY_LABEL[exam.category ?? "ASSESSMENT"]}
                      {" · "}
                      {EXAM_TYPE_LABEL[exam.examType ?? "MIXED"]}
                    </p>
                    <div className="grid gap-2 border-t pt-3">
                      <InfoRow icon={CalendarClock} label="Created" value={formatDateTime(exam.createdAt)} />
                      <InfoRow icon={User} label="Created by" value={exam.createdByName || "—"} />
                      <InfoRow icon={Clock} label="Duration" value={`${exam.durationMinutes} mins`} />
                      <InfoRow icon={ListChecks} label="Questions" value={exam.questionIds?.length ?? exam.questions?.length ?? 0} />
                      <InfoRow icon={Trophy} label="Max score" value={exam.maxScore ?? 10} />
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={examPage === 0} onClick={() => setExamPage((page) => page - 1)}>Previous</Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">{examTotalPages === 0 ? 0 : examPage + 1} / {examTotalPages}</span>
            <Button variant="outline" size="sm" disabled={examPage + 1 >= examTotalPages} onClick={() => setExamPage((page) => page + 1)}>Next</Button>
          </div>
        </section>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
            <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                  event.preventDefault();
                  const problem = validateConfig(Number(newDuration), cfg);
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  createExamMutation.mutate();
                }}
            >
              <DialogHeader className="shrink-0">
                <DialogTitle>Create Exam</DialogTitle>
                <DialogDescription>Configure exam title, duration, and rules.</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto py-5 pr-1">
                <ExamConfigFields
                    title={newTitle}
                    setTitle={setNewTitle}
                    duration={newDuration}
                    setDuration={setNewDuration}
                    cfg={cfg}
                    setCfg={setCfg}
                />
              </div>
              <DialogFooter className="shrink-0 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createExamMutation.isPending || !newTitle.trim()}>
                  {createExamMutation.isPending ? "Saving..." : "Create Exam"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </MainLayout>
  );
}
