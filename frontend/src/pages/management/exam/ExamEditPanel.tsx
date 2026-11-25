import { assessmentReturnPath } from "@/utils/assessment-navigation";
import { examApi, examTemplateApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ExamDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Save, ShieldAlert, Trash2 } from "lucide-react";
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

  const [examToSaveAsTemplate, setExamToSaveAsTemplate] = useState<ExamDTO | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
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

  const saveExamAsTemplateMutation = useMutation({
    mutationFn: () => {
      if (!examToSaveAsTemplate?.id) {
        throw new Error("Select an exam before saving it as a template.");
      }
      const name = templateName.trim();
      if (!name) {
        throw new Error("Template name is required.");
      }
      return examTemplateApi.saveFromExam(examToSaveAsTemplate.id, {
        name,
        description: templateDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      setExamToSaveAsTemplate(null);
      setTemplateName("");
      setTemplateDescription("");
      toast.success("Exam saved as template successfully");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Failed to save exam as template")),
  });

  const openSaveAsTemplate = (target: ExamDTO) => {
    setExamToSaveAsTemplate(target);
    setTemplateName(`${target.title} - Template`);
    setTemplateDescription("");
  };

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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(exam)}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => openSaveAsTemplate(exam)}>
              <BookmarkPlus className="mr-2 size-4" />
              Save as Template
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

      <Dialog
        open={Boolean(examToSaveAsTemplate)}
        onOpenChange={(open) => {
          if (!open && !saveExamAsTemplateMutation.isPending) {
            setExamToSaveAsTemplate(null);
            setTemplateName("");
            setTemplateDescription("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!templateName.trim()) {
                toast.error("Template name is required.");
              }
              saveExamAsTemplateMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Save Exam as Template</DialogTitle>
              <DialogDescription>
                Save the configuration, questions, and answer options from
                <strong className="text-foreground"> {examToSaveAsTemplate?.title}</strong>
                {" "}as a reusable template. The original exam will not be changed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <label className="grid gap-2 text-sm font-medium">
                Template Name
                <Input
                  required
                  maxLength={200}
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Enter template name"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Description (optional)
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  maxLength={1000}
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder="Describe when this template should be reused"
                />
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveExamAsTemplateMutation.isPending}
                onClick={() => {
                  setExamToSaveAsTemplate(null);
                  setTemplateName("");
                  setTemplateDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveExamAsTemplateMutation.isPending || !templateName.trim()}
              >
                {saveExamAsTemplateMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </form>
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
    </>
  );
}
