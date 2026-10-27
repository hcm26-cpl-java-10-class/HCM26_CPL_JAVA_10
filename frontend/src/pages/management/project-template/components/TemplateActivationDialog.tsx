import { projectTemplateApi } from "@/api/features/project-template.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectTemplateDTO, TemplateConfigurationSection } from "@/types/features/project-template";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CircleCheck, CircleX, Loader2, RefreshCw, Rocket } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";

function ActivationIssues({ errors }: { errors: Record<string, string[]> }) {
  return <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
    {Object.entries(errors).flatMap(([path, messages]) => messages.map((message) => {
      const milestone = path.match(/^milestones\[(\d+)\]/);
      const criterion = path.match(/rubricCriteria\[(\d+)\]/);
      const prefix = [milestone && `Milestone ${Number(milestone[1]) + 1}`, criterion && `criterion ${Number(criterion[1]) + 1}`]
        .filter(Boolean).join(", ");
      return <li key={`${path}-${message}`} className="break-words">{prefix && `${prefix}: `}{message}</li>;
    }))}
  </ul>;
}

export function TemplateActivationDialog({ template, onActivated, onOpenSection }: {
  template: ProjectTemplateDTO;
  onActivated: (template: ProjectTemplateDTO) => void;
  onOpenSection: (section: TemplateConfigurationSection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const submitting = useRef(false);
  const { user, activeRole } = usePermissions();
  const checklist = useQuery({
    queryKey: ["project-templates", user.email, activeRole, "activation", template.id],
    queryFn: ({ signal }) => projectTemplateApi.getActivationChecklist(template.id, signal),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (lockVersion: number) => projectTemplateApi.activate(template.id, lockVersion),
    onSuccess: (saved) => {
      setOpen(false);
      toast.success("Project template activated successfully.");
      onActivated(saved);
    },
    onError: (error) => setSubmitError(getTemplateError(error)),
    onSettled: () => { submitting.current = false; },
  });
  const checking = checklist.isFetching;
  const blocked = !checklist.data?.ready || !checklist.data.canActivate || checklist.isError
    || checking || mutation.isPending || !!submitError;
  const refresh = async () => {
    if (submitting.current) return;
    const result = await checklist.refetch();
    if (result.isSuccess) setSubmitError(null);
  };
  const activate = () => {
    if (submitting.current || blocked || !checklist.data) return;
    submitting.current = true;
    mutation.mutate(checklist.data.lockVersion);
  };
  const openSection = (section: TemplateConfigurationSection) => {
    if (submitting.current) return;
    setOpen(false);
    onOpenSection(section);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (submitting.current) return;
      setOpen(value);
      if (value) setSubmitError(null);
    }}>
      <DialogTrigger asChild><Button><Rocket /> Activate</Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl" showCloseButton={!mutation.isPending}
        onEscapeKeyDown={(event) => { if (submitting.current) event.preventDefault(); }}
        onInteractOutside={(event) => { if (submitting.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Activate project template</DialogTitle>
          <DialogDescription>Review the saved configuration before making this template available for classes and cohorts.</DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          Save any pending changes first. Once activated, this template becomes read-only.
        </p>
        {submitError && <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>Unable to activate template</AlertTitle>
          <AlertDescription>
            <p>{submitError.message}</p>
            <ActivationIssues errors={submitError.fields} />
            <p className="mt-2">Check the latest configuration before trying again.</p>
          </AlertDescription>
        </Alert>}
        {checking && <div role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking activation requirements...
        </div>}
        {checklist.isError ? <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>Unable to check activation requirements</AlertTitle>
          <AlertDescription>{getTemplateError(checklist.error).message}</AlertDescription>
        </Alert> : checklist.data && !checking && <div className="grid gap-3" aria-label="Activation checklist">
          {checklist.data.items.map((item) => <section key={item.section} className="min-w-0 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              {item.passed ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                : <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />}
              <h2 className="min-w-0 flex-1 text-sm font-medium">{item.label}</h2>
              <Badge variant={item.passed ? "secondary" : "outline"} className="shrink-0">{item.passed ? "Ready" : "Incomplete"}</Badge>
            </div>
            {!item.passed && <>
              <ActivationIssues errors={item.errors} />
              <Button variant="link" size="sm" className="mt-2 h-auto px-0" disabled={mutation.isPending}
                onClick={() => openSection(item.section)}>Open {item.section === "overview" ? "general information" : item.section === "team-constraints" ? "team constraints" : "milestones"}</Button>
            </>}
          </section>)}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {checklist.data.status !== "DRAFT" ? "This template is no longer a draft. It cannot be activated again."
              : !checklist.data.canActivate ? "You do not have permission to activate this template."
              : checklist.data.ready ? "All required configuration is complete. This template is ready to activate."
              : "Complete the missing configuration, save it, then check again."}
          </p>
        </div>}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="outline" disabled={checking || mutation.isPending} onClick={() => void refresh()}>
            <RefreshCw className={checking ? "animate-spin" : undefined} /> Check again
          </Button>
          <Button disabled={blocked} onClick={activate}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Rocket />}
            {mutation.isPending ? "Activating..." : "Activate template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
