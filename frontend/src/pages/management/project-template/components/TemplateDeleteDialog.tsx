import { projectTemplateApi } from "@/api/features/project-template.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ProjectTemplateDTO } from "@/types/features/project-template";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";

export function TemplateDeleteDialog({ template, onDeleted }: { template: ProjectTemplateDTO; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const pending = useRef(false);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => projectTemplateApi.delete(template.id, template.lockVersion),
    onSuccess: () => {
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["project-templates"] });
      void client.invalidateQueries({ queryKey: ["project-template-versions"] });
      toast.success("Template draft deleted successfully.");
      onDeleted?.();
    },
    onSettled: () => { pending.current = false; },
  });
  const error = mutation.isError ? getTemplateError(mutation.error) : null;
  return <Dialog open={open} onOpenChange={value => {
    if (pending.current) return;
    setOpen(value);
    if (value) mutation.reset();
  }}>
    <DialogTrigger asChild><Button variant="outline" size="icon" className="text-destructive" aria-label={`Delete template ${template.code}`}>
      <Trash2 className="size-4" />
    </Button></DialogTrigger>
    <DialogContent showCloseButton={!mutation.isPending} onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }}
      onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Delete template draft?</DialogTitle>
        <DialogDescription>Only drafts that have never been assigned to a team, class or project can be deleted.</DialogDescription></DialogHeader>
      <p className="break-words rounded-lg border p-3 text-sm font-medium">{template.code} · {template.name}</p>
      {error && <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>}
      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="destructive" disabled={mutation.isPending || !!error} onClick={() => {
          if (pending.current) return;
          pending.current = true;
          mutation.mutate();
        }}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {mutation.isPending ? "Deleting..." : "Delete draft"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
