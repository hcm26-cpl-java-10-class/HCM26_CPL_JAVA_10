import { projectTemplateApi } from "@/api/features/project-template.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ProjectTemplateDTO } from "@/types/features/project-template";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Archive, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";

export function TemplateArchiveDialog({ template, onArchived, compact = false }: {
  template: ProjectTemplateDTO;
  onArchived: (saved: ProjectTemplateDTO) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: () => projectTemplateApi.archive(template.id, template.lockVersion),
    onSuccess: (saved) => {
      setOpen(false);
      toast.success("Project template archived successfully.");
      onArchived(saved);
    },
    onError: (failure) => setError(getTemplateError(failure)),
    onSettled: () => { submitting.current = false; },
  });
  const archive = () => {
    if (submitting.current || error || template.status !== "ACTIVE") return;
    submitting.current = true;
    mutation.mutate();
  };

  return <Dialog open={open} onOpenChange={(value) => {
    if (submitting.current) return;
    setOpen(value);
    if (value) setError(null);
  }}>
    <DialogTrigger asChild><Button variant="outline" size={compact ? "icon" : "default"}
      aria-label={compact ? `Archive template ${template.code}` : undefined} title={compact ? "Archive template" : undefined}>
      <Archive />{!compact && "Archive"}
    </Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg" showCloseButton={!mutation.isPending}
      onEscapeKeyDown={(event) => { if (submitting.current) event.preventDefault(); }}
      onInteractOutside={(event) => { if (submitting.current) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Archive project template?</DialogTitle>
        <DialogDescription>This template will no longer be available for new classes or cohorts. Existing projects will continue to use their saved configuration.</DialogDescription>
      </DialogHeader>
      <p className="break-words rounded-lg border bg-muted/30 p-3 text-sm font-medium">{template.code} · {template.name}</p>
      <p className="text-sm text-muted-foreground">The template and its history remain available in the management library.</p>
      {error && <Alert variant="destructive" role="alert"><AlertCircle /><AlertTitle>Unable to archive template</AlertTitle>
        <AlertDescription>{error.message} Close this dialog and reload the template before trying again.</AlertDescription></Alert>}
      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={mutation.isPending || !!error} onClick={archive}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Archive />}
          {mutation.isPending ? "Archiving..." : "Archive template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
