import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { projectCompletionApi } from "@/api/features/project-completion.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectCompletionSummary } from "@/types/features/project-completion";

const NOTE_LIMIT = 500;

const finalizeSchema = z.object({
  finalScore: z.string().trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a score from 0 to 100 with up to 2 decimals")
    .refine(value => Number(value) <= 100, "Enter a score from 0 to 100 with up to 2 decimals"),
  note: z.string().max(NOTE_LIMIT, `Keep the note within ${NOTE_LIMIT} characters`),
});
type FinalizeValues = z.infer<typeof finalizeSchema>;

const COMPLETION_QUERY_KEYS = ["project-completion", "workspace-project-hierarchy", "workspace-navigation",
  "workspace-milestones", "workspace-master-milestones"];

function errorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function errorMessage(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) && error.response?.data?.message
    ? error.response.data.message : "Unable to finalize the project. Please try again.";
}

function finalizeLabel(summary: ProjectCompletionSummary, hierarchical: boolean) {
  if (!hierarchical) return "Finalize project";
  return summary.master ? "Finalize master project" : "Finalize module";
}

function pendingHint(summary: ProjectCompletionSummary) {
  if (summary.readiness === "MILESTONES_PENDING") {
    const count = summary.pendingMilestones.length;
    return `${count} mandatory milestone${count === 1 ? "" : "s"} not accepted or waived`;
  }
  if (summary.readiness === "CHILDREN_PENDING") {
    const count = summary.pendingChildren.length;
    return `Waiting for ${count} module${count === 1 ? "" : "s"} to be completed`;
  }
  return null;
}

/**
 * Finalize button of the selected project: shown only when the backend reports the project as READY for a
 * user who manages its assessment; a completed project shows its completion state instead.
 */
export function ProjectFinalizeAction({ projectId, teamId, hierarchical }: {
  projectId: number; teamId: number | null; hierarchical: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const summary = useQuery({
    queryKey: ["project-completion", projectId, teamId, user.email, activeRole],
    queryFn: ({ signal }) => projectCompletionApi.summary(projectId, teamId, signal),
    retry: false, staleTime: 0,
  });
  const form = useForm<FinalizeValues>({ resolver: zodResolver(finalizeSchema), defaultValues: { finalScore: "", note: "" } });
  const finalize = useMutation({
    mutationFn: (values: FinalizeValues) => projectCompletionApi.finalize(projectId, teamId, {
      finalScore: Number(values.finalScore), note: values.note.trim() || undefined,
    }),
    onSuccess: () => {
      setOpen(false);
      toast.success("Project finalized. Its final score is locked.");
      for (const key of COMPLETION_QUERY_KEYS) void client.invalidateQueries({ queryKey: [key] });
    },
    onError: error => {
      // The project changed while the dialog was open (e.g. a milestone was reopened): reload its readiness.
      // The refetch can hide the button (and this dialog), so the reason is also raised as a toast.
      if (errorStatus(error) === 409) { toast.error(errorMessage(error)); void summary.refetch(); }
    },
  });

  const data = summary.data;
  // Users without access to the assessment (e.g. a shared master outside their scope) simply see no action.
  if (!data || summary.isError) return null;

  // The heading's status badge already reads "Completed"; add the locked score and when it was finalized.
  if (data.readiness === "COMPLETED") {
    return <div className="flex flex-wrap items-center gap-2" role="status">
      {data.canManage && data.finalScore !== null && <Badge variant="outline" className="gap-1.5 rounded-full px-2.5 py-0.5">
        <LockKeyhole className="size-3" />Final score {Number(data.finalScore).toFixed(2)}
      </Badge>}
      {data.finalizedAt && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-600" />Finalized {new Date(data.finalizedAt).toLocaleDateString("en-GB")}</span>}
    </div>;
  }

  if (!data.canFinalize) {
    const hint = data.canManage ? pendingHint(data) : null;
    return hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null;
  }

  const label = finalizeLabel(data, hierarchical);
  function openDialog() {
    finalize.reset();
    form.reset({ finalScore: data?.suggestedScore != null ? Number(data.suggestedScore).toFixed(2) : "", note: "" });
    setOpen(true);
  }
  const submit = form.handleSubmit(values => { if (!finalize.isPending) finalize.mutate(values); });
  const { errors } = form.formState;

  return <>
    <Button size="sm" onClick={openDialog}><LockKeyhole className="size-4" />{label}</Button>
    <Dialog open={open} onOpenChange={next => { if (!finalize.isPending) setOpen(next); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={event => void submit(event)} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{label}?</DialogTitle>
            <DialogDescription>
              All mandatory milestones are accepted or waived{data.master && hierarchical ? " and every module is completed" : ""}.
              After finalizing, the final score is locked and the project becomes read-only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`finalize-score-${projectId}`}>Final score (0–100)</Label>
            <Input id={`finalize-score-${projectId}`} inputMode="decimal" autoFocus disabled={finalize.isPending}
              aria-invalid={!!errors.finalScore} aria-describedby={errors.finalScore ? `finalize-score-error-${projectId}` : undefined}
              {...form.register("finalScore")} />
            {errors.finalScore
              ? <p id={`finalize-score-error-${projectId}`} className="text-xs text-destructive">{errors.finalScore.message}</p>
              : data.suggestedScore != null && <p className="text-xs text-muted-foreground">Suggested from accepted milestone reviews: {Number(data.suggestedScore).toFixed(2)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`finalize-note-${projectId}`}>Note (optional)</Label>
            <Textarea id={`finalize-note-${projectId}`} maxLength={NOTE_LIMIT} disabled={finalize.isPending}
              aria-invalid={!!errors.note} {...form.register("note")} />
            {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
          </div>
          {finalize.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(finalize.error)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={finalize.isPending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={finalize.isPending}>{finalize.isPending ? "Finalizing…" : "Confirm and lock"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
