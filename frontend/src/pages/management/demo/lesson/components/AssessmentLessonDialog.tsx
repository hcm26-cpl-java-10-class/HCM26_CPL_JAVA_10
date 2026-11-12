import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/axios";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExamCategory, LessonDTO } from "@/types";
import { ExamConfigFields } from "@/pages/management/exam/ExamConfigFields";
import { buildExamRequest, DEFAULT_CONFIG, getErrorMessage, validateConfig, type ExamConfigForm } from "@/pages/management/exam/examConfig";
import { toast } from "sonner";

interface Props {
  open: boolean; onOpenChange: (open: boolean) => void; sectionId: number;
  type: "QUIZ" | "EXAM" | "ASSIGNMENT"; initialTitle: string; initialInstructions: string;
  initialOrder: string; onBack: () => void; onSuccess?: (lesson: LessonDTO) => void;
}
export function AssessmentLessonDialog(props: Props) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const categories: ExamCategory[] = props.type === "EXAM" ? ["MIDTERM", "FINAL_TEST"] : [props.type];
  const [title, setTitle] = useState(props.initialTitle);
  const [duration, setDuration] = useState("60");
  const [instructions, setInstructions] = useState(props.initialInstructions);
  const [order, setOrder] = useState(props.initialOrder);
  const [cfg, setCfg] = useState<ExamConfigForm>({ ...DEFAULT_CONFIG, category: categories[0], maxAttempts: "1" });
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      const assessment = buildExamRequest(title, duration, cfg, true);
      const lesson: LessonDTO = { sectionId: props.sectionId, title: title.trim(), contentType: props.type,
        textContent: instructions.trim(), orderIndex: Number(order), isActive: true };
      return (await api.post<{ lesson: LessonDTO }>("/lessons/with-assessment", { lesson, assessment })).data;
    },
    onSuccess: async ({ lesson }) => {
      await Promise.all(["lessons", "exam-management", "course-exams", "curriculum", "course-assessment-allocation", "course-assessment-plan", "course-selected-curriculum", "section-lessons"].map(key =>
        queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success("Assessment and lesson created and linked.");
      props.onSuccess?.(lesson); props.onOpenChange(false);
    },
    onError: error => setError(getErrorMessage(error, "Could not create the assessment lesson.")),
  });
  function save() {
    setShowErrors(true); setError("");
    const validation = !title.trim() || title.trim().length > 200 ? "Enter a title of up to 200 characters." :
      !instructions.trim() ? "Enter assessment instructions." :
      order === "" || !Number.isInteger(Number(order)) || Number(order) < 0 ? "Order index must be a non-negative whole number." :
      !Number.isInteger(Number(duration)) || Number(duration) < 1 ? "Duration must be a positive whole number of minutes." :
      validateConfig(Number(duration), cfg);
    if (validation) { setError(validation); return; }
    mutation.mutate();
  }
  return <Dialog open={props.open} onOpenChange={next => { if (!mutation.isPending) props.onOpenChange(next); }}>
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
      <DialogHeader><DialogTitle>Create {props.type === "QUIZ" ? "Quiz" : props.type === "EXAM" ? "Exam" : "Assignment"} lesson</DialogTitle>
        <DialogDescription>Create an assessment using the Assessment Management form. It will be linked automatically to this lesson in section #{props.sectionId}.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto p-1">
        {!hasPermission("EXAM_CREATE") && <p role="alert" className="text-destructive">You need assessment creation permission to create this lesson and its assessment.</p>}
        <ExamConfigFields title={title} setTitle={setTitle} duration={duration} setDuration={setDuration}
          cfg={cfg} setCfg={setCfg} showErrors={showErrors} showCourseLink={false} categoryOptions={categories} />
        <label className="grid gap-2"><Label>Assessment instructions</Label>
          <Textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Tell students how to complete this assessment." /></label>
        <label className="grid gap-2"><Label>Lesson order index</Label>
          <Input type="number" min={0} step={1} value={order} onChange={event => setOrder(event.target.value)} /></label>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4">
        <Button variant="outline" disabled={mutation.isPending} onClick={props.onBack}>Back to lesson types</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => props.onOpenChange(false)}>Cancel</Button>
        <Button disabled={mutation.isPending || !hasPermission("EXAM_CREATE")} onClick={save}>
          {mutation.isPending ? "Creating…" : "Create assessment lesson"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
