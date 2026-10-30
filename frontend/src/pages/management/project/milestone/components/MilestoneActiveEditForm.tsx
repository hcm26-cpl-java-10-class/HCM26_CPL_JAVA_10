import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { milestoneApi } from "@/api/features/milestone.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneDetailResponse } from "@/types";
import { getMilestoneApiError } from "../milestone.utils";

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function MilestoneActiveEditForm({ milestone, projectId, teamId, onCancel, onSaved, onDirtyChange }: {
  milestone: MilestoneDetailResponse;
  projectId?: string;
  teamId: number;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const onlyDeadline = milestone.lifecycleStatus === "CHANGES_REQUESTED";
  const initialDeadline = toLocalDateTime(milestone.deadline);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [deadline, setDeadline] = useState(initialDeadline);
  const descriptionChanged = !onlyDeadline && description !== (milestone.description ?? "");
  const deadlineChanged = deadline !== initialDeadline;
  const selectedDeadline = deadline ? new Date(deadline) : null;
  const deadlineError = !selectedDeadline || Number.isNaN(selectedDeadline.getTime())
    ? "Enter a valid deadline."
    : deadlineChanged && selectedDeadline.getTime() <= new Date(milestone.deadline).getTime()
      ? "The new deadline must be later than the current deadline."
      : deadlineChanged && selectedDeadline.getTime() <= Date.now()
        ? "The extended deadline must be in the future."
        : null;
  const dirty = descriptionChanged || deadlineChanged;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: () => milestoneApi.editActive(projectId, teamId, milestone.id, {
      expectedVersion: milestone.version,
      deadline: deadlineChanged ? selectedDeadline!.toISOString() : milestone.deadline,
      ...(onlyDeadline ? {} : { description }),
    }),
    onSuccess: () => {
      toast.success("Milestone changes saved.");
      onSaved();
    },
  });

  return <Card className="mx-auto w-full max-w-3xl">
    <CardHeader>
      <CardTitle>{onlyDeadline ? "Extend resubmission deadline" : "Edit in-progress milestone"}</CardTitle>
      <CardDescription>{milestone.title}</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="grid gap-6" onSubmit={event => { event.preventDefault(); if (dirty && !deadlineError) mutation.mutate(); }}>
        {!onlyDeadline && <div className="grid gap-2">
          <Label htmlFor="active-milestone-description">Description</Label>
          <Textarea id="active-milestone-description" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
        </div>}
        <div className="grid gap-2">
          <Label htmlFor="active-milestone-deadline">{onlyDeadline ? "Resubmission deadline" : "Deadline"}</Label>
          <Input id="active-milestone-deadline" type="datetime-local" required value={deadline} onChange={event => setDeadline(event.target.value)} aria-invalid={Boolean(deadlineError)} />
          <p className="text-xs text-muted-foreground">Current deadline: {new Date(milestone.deadline).toLocaleString()}</p>
          {deadlineError && <p className="text-sm text-destructive">{deadlineError}</p>}
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Rubric: {milestone.rubric?.name ?? "Not configured"} (locked). Changes are saved as a new revision.
        </div>
        {mutation.isError && <p className="text-sm text-destructive">{getMilestoneApiError(mutation.error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !dirty || Boolean(deadlineError)}>Save changes</Button>
        </div>
      </form>
    </CardContent>
  </Card>;
}
