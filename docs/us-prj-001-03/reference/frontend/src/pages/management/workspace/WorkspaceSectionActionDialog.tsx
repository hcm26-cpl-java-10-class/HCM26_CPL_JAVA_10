import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import type { WorkspaceSectionKey, WorkspaceSectionItem, SectionReview } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sectionForbidden } from "./WorkspaceSectionState";
import { getWorkspaceError } from "./workspace.shared";

export function WorkspaceSectionActionDialog({ workspaceId, section, action, items, editing,
  onClose, onAccessChanged }: {
  workspaceId: number; section: WorkspaceSectionKey; action: string;
  items: WorkspaceSectionItem[]; editing?: WorkspaceSectionItem;
  onClose: () => void; onAccessChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [published, setPublished] = useState(false);
  const [targetId, setTargetId] = useState(items[0]?.id ?? "");
  const [score, setScore] = useState("");
  const review = action === "review";
  const labels: Record<string, string> = { create: "Create item", createTask: "Create task",
    submit: "Submit artifact", review: "Record review", edit: "Edit task" };
  const mutation = useMutation({
    mutationFn: () => {
      if (review) {
        const kinds: Partial<Record<WorkspaceSectionKey, SectionReview["kind"]>> = {
          milestones: "MILESTONE", sprints: "SPRINT", artifacts: "ARTIFACT"
        };
        const kind = kinds[section];
        if (!kind) throw new Error("This section cannot be reviewed.");
        return workspaceApi.review(workspaceId, {
          kind, targetId, comment: description, score: score === "" ? undefined : Number(score), published
        });
      }
      const input = { title, description, published };
      if (editing) return workspaceApi.updateTask(workspaceId, editing.id, input);
      const path = action === "submit" ? "artifacts/submit" : action === "createTask" ? "tasks" : section;
      return workspaceApi.createSectionItem(workspaceId, path, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId] });
      onClose();
    },
    onError: error => { if (sectionForbidden(error)) onAccessChanged(); }
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mutation.isPending && !sectionForbidden(mutation.error)) mutation.mutate();
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{labels[action]}</DialogTitle>
      <DialogDescription>Apply this action to the current workspace.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {review ? <div className="space-y-2"><Label>Review target</Label>
          <Select value={targetId} onValueChange={setTargetId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
          </Select></div>
          : <div className="space-y-2"><Label htmlFor="section-title">Title</Label><Input id="section-title"
              required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="section-description">{review ? "Review comments" : "Description"}</Label>
          <Textarea id="section-description" required={review} maxLength={2000} value={description}
            onChange={event => setDescription(event.target.value)} /></div>
        {review && <div className="space-y-2"><Label htmlFor="section-score">Score (optional)</Label>
          <Input id="section-score" type="number" min={0} max={10} step="0.1" value={score}
            onChange={event => setScore(event.target.value)} /></div>}
        {(review || action === "create" && ["milestones", "feedback"].includes(section)) &&
          <div className="flex items-center gap-2"><Checkbox id="section-published" checked={published}
            onCheckedChange={value => setPublished(value === true)} /><Label htmlFor="section-published">Publish for students</Label></div>}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(mutation.error)}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || sectionForbidden(mutation.error) || review && !targetId}>
            {mutation.isPending ? "Saving..." : labels[action]}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
