import { assessmentReturnPath } from "@/utils/assessment-navigation";
import { examApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ExamDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExamConfigFields } from "./ExamConfigFields";
import { buildExamRequest, configFromExam, DEFAULT_CONFIG, getErrorMessage, validateConfig, type ExamConfigForm } from "./examConfig";

export function ExamEditPanel({ examId }: { examId: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const returnTo = assessmentReturnPath(new URLSearchParams(search).get("returnTo"));
  const returnQuery = returnTo === "/exams" ? "" : "?returnTo=" + encodeURIComponent(returnTo);
  const examQuery = useQuery({
    queryKey: ["exam-detail", examId],
    queryFn: () => examApi.getById(String(examId)),
  });
  const exam: ExamDTO | null = examQuery.data ?? null;

  const [newTitle, setNewTitle] = useState(exam?.title ?? "");
  const [newDuration, setNewDuration] = useState(String(exam?.durationMinutes ?? "60"));
  const [cfg, setCfg] = useState<ExamConfigForm>(() => (exam ? configFromExam(exam) : DEFAULT_CONFIG));
  const [showErrors, setShowErrors] = useState(false);

  // Fill the form once per saved version of the exam (a refetch of the same version never wipes your edits).
  const version = exam ? `${exam.id}:${exam.updatedAt ?? ""}` : "";
  useEffect(() => {
    if (!exam) return;
    setNewTitle(exam.title);
    setNewDuration(String(exam.durationMinutes));
    setCfg(configFromExam(exam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const [examToDelete, setExamToDelete] = useState<ExamDTO | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const saveExamMutation = useMutation({
    mutationFn: () => examApi.update(String(examId), buildExamRequest(newTitle, newDuration, cfg, exam?.isActive ?? true)),
    onSuccess: (updated) => {
      queryClient.setQueryData(["exam-detail", examId], updated);
      setCfg(configFromExam(updated));
      void queryClient.invalidateQueries({ queryKey: ["exam-management"] });
      toast.success("Exam updated successfully");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to save exam")),
  });

  const deleteExamMutation = useMutation({
    mutationFn: () => examApi.delete(String(examId)),
    onSuccess: () => {
      setExamToDelete(null);
      setDeleteConfirmInput("");
      queryClient.removeQueries({ queryKey: ["exam-detail", examId] });
      void queryClient.invalidateQueries({ queryKey: ["exam-management"] });
      toast.success("Exam deleted successfully");
      navigate(returnTo);
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to delete exam")),
  });

  const openDeleteConfirm = (target: ExamDTO) => {
    setExamToDelete(target);
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
    deleteExamMutation.mutate();
  };

  // Unsaved changes: compare the form with the saved exam.
  const dirty = exam
    ? JSON.stringify([newTitle, newDuration, cfg]) !==
    JSON.stringify([exam.title, String(exam.durationMinutes), configFromExam(exam)])
    : false;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (examQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading exam...</p>;
  }
  if (!exam) {
    return <p className="py-10 text-center text-sm text-destructive">Failed to load the exam.</p>;
  }

  return (
    <>
      <form
        className="flex min-w-0 max-w-full flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const problem = validateConfig(Number(newDuration), cfg);
          if (problem) {
            setShowErrors(true);
            toast.error(problem);
            return;
          }
          saveExamMutation.mutate();
        }}
      >
        <ExamConfigFields
          title={newTitle}
          setTitle={setNewTitle}
          duration={newDuration}
          setDuration={setNewDuration}
          cfg={cfg}
          setCfg={setCfg}
          editingExam={exam}
          showErrors={showErrors}
        />

        <div className="sticky bottom-0 z-10 -mx-6 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-6 py-3 backdrop-blur-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(exam)}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-purple-700 hover:text-purple-800 dark:text-purple-300"
              onClick={() => navigate(`/exams/${examId}/similarity${returnQuery}`)}
            >
              <ShieldAlert className="mr-2 size-4 text-purple-600" />
              AI Similarity Check
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            <Button type="submit" disabled={saveExamMutation.isPending || !newTitle.trim() || !dirty}>
              <Save className="mr-2 size-4" />
              {saveExamMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>

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
    </>
  );
}
