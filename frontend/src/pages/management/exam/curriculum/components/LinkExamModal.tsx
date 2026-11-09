import { examApi } from "@/api";
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
import { EXAM_CATEGORY_LABEL } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ClipboardList, Clock, HelpCircle, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface LinkExamModalProps {
  courseId: number;
  target: { type: "section" | "lesson" | "course"; id?: number; title: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LinkExamModal({
  courseId,
  target,
  open,
  onOpenChange,
  onSuccess,
}: LinkExamModalProps) {
  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const availableExamsQuery = useQuery({
    queryKey: ["available-exams-for-course", courseId],
    queryFn: () => examApi.getAvailableExamsForCourse(courseId),
    enabled: open && courseId > 0,
  });

  const linkMutation = useMutation({
    mutationFn: (examId: number) => {
      const params: { sectionId?: number; lessonId?: number } = {};
      if (target?.type === "section" && target.id) {
        params.sectionId = target.id;
      } else if (target?.type === "lesson" && target.id) {
        params.lessonId = target.id;
      }
      return examApi.linkToCurriculum(courseId, examId, params);
    },
    onSuccess: () => {
      toast.success(`Exam linked to ${target?.title || "curriculum"} successfully!`);
      setSelectedExamId(null);
      setSearch("");
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to link exam.");
    },
  });

  const exams = availableExamsQuery.data ?? [];
  const filteredExams = exams.filter((e) =>
    (e.title || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleConfirm = () => {
    if (!selectedExamId) {
      toast.error("Please select an exam to attach.");
      return;
    }
    linkMutation.mutate(selectedExamId);
  };

  const cleanTitle = (target?.title || "").replace(/^(section|lesson)\s*:\s*/i, "");
  const targetLabel =
    target?.type === "section"
      ? `Section: ${cleanTitle}`
      : target?.type === "lesson"
      ? `Lesson: ${cleanTitle}`
      : "Whole Course";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-xl flex-col gap-0 p-0 sm:max-w-2xl overflow-hidden rounded-xl border bg-card shadow-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="size-5 text-primary" />
            Attach Assessment to {target?.type === "lesson" ? "Lesson" : target?.type === "section" ? "Section" : "Course"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Target: <span className="font-medium text-foreground">{targetLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assessment by title..."
              className="pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[16rem] max-h-[22rem]">
            {availableExamsQuery.isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading available assessments...</p>
            ) : availableExamsQuery.isError ? (
              <p className="py-12 text-center text-sm text-destructive">Failed to load assessments.</p>
            ) : filteredExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <HelpCircle className="size-8 stroke-1 text-muted-foreground/60" />
                <p className="text-sm font-medium">No available assessments found.</p>
                <p className="text-xs">
                  Create a new assessment in Assessment Management to attach it here.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2 text-xs">
                  <a href="/exams" target="_blank" rel="noopener noreferrer">
                    <Plus className="mr-1 size-3.5" /> Go to Assessments
                  </a>
                </Button>
              </div>
            ) : (
              filteredExams.map((exam) => {
                const isSelected = selectedExamId === exam.id;
                const isAlreadyLinkedHere =
                  target?.type === "section"
                    ? exam.sectionId === target.id && !exam.lessonId
                    : target?.type === "lesson"
                    ? exam.lessonId === target.id
                    : !exam.sectionId && !exam.lessonId;

                return (
                  <div
                    key={exam.id}
                    onClick={() => setSelectedExamId(exam.id)}
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                        : "hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{exam.title}</span>
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                          {EXAM_CATEGORY_LABEL[exam.category] || exam.category}
                        </Badge>
                        {isAlreadyLinkedHere && (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40 bg-emerald-500/10">
                            Currently attached here
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {exam.durationMinutes} mins
                        </span>
                        <span>•</span>
                        <span>{exam.questionCount ?? 0} questions</span>
                        <span>•</span>
                        <span>Max score: {exam.maxScore ?? 10}</span>
                      </div>

                      {(exam.sectionTitle || exam.lessonTitle) && !isAlreadyLinkedHere && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          Currently attached to: {exam.lessonTitle ? `Lesson "${exam.lessonTitle}"` : `Section "${exam.sectionTitle}"`}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && <Check className="size-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="m-0 flex flex-row items-center justify-end gap-3 border-t bg-muted/20 px-6 py-4 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            className="h-9 px-4 text-xs font-medium"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 px-4 text-xs font-semibold shadow-xs"
            disabled={!selectedExamId || linkMutation.isPending}
            onClick={handleConfirm}
          >
            {linkMutation.isPending ? "Attaching..." : "Attach Assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
