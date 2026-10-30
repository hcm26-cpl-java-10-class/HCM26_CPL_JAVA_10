import { projectTemplateApi } from "@/api/features/project-template.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import type { TemplateSampleContent, TemplateSampleContentPayload, TemplateBacklogInput } from "@/types/features/project-template";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ClipboardList, Loader2, Plus, Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";
import { newBacklogItem, sampleFieldId, toSamplePayload, toSampleValues, validateSampleContent,
  type BacklogItemValues, type SampleContentErrors } from "../sample-content.utils";
import { TemplateBacklogImportDialog } from "./TemplateBacklogImportDialog";
import { TemplateBacklogEditor } from "./TemplateSampleEditors";

function moved<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const result = [...items]; [result[index], result[index + direction]] = [result[index + direction], result[index]]; return result;
}

export function TemplateSampleContentForm({ content, editable, onSaved, save, previewImport, downloadImportTemplate }: {
  content: TemplateSampleContent; editable: boolean; onSaved: (saved: TemplateSampleContent) => void;
  save?: (payload: TemplateSampleContentPayload) => Promise<TemplateSampleContent>;
  previewImport?: (file: File) => Promise<TemplateBacklogInput[]>;
  downloadImportTemplate?: () => Promise<Blob>;
}) {
  const [values, setValues] = useState(() => toSampleValues(content));
  const [savedBacklog, setSavedBacklog] = useState(() => JSON.stringify(toSamplePayload(values, 0).backlogItems));
  const [lockVersion, setLockVersion] = useState(content.lockVersion);
  const [errors, setErrors] = useState<SampleContentErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const [removing, setRemoving] = useState<{ key: string; title: string } | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({ mutationFn: (payload: TemplateSampleContentPayload) => save ? save(payload) : projectTemplateApi.saveSampleContent(content.templateId, payload),
    onSuccess: (saved) => {
      const savedValues = toSampleValues(saved);
      setValues(savedValues); setSavedBacklog(JSON.stringify(toSamplePayload(savedValues, 0).backlogItems));
      setLockVersion(saved.lockVersion); setErrors({}); setSubmitError(null);
      onSaved(saved); toast.success("Sample backlog saved successfully.");
    },
    onError: (error) => { const result = getTemplateError(error); setErrors(result.fields); setSubmitError(result); },
    onSettled: () => { submitting.current = false; },
  });
  const canEdit = editable && content.editable;
  const hasChanges = JSON.stringify(toSamplePayload(values, 0).backlogItems) !== savedBacklog;
  const disabled = !canEdit || mutation.isPending;
  const clearErrors = (prefix: string) => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith(prefix))));
  const changeBacklog = (index: number, patch: Partial<BacklogItemValues>) => {
    setValues((current) => ({ ...current, backlogItems: current.backlogItems.map((item, i) => i === index ? { ...item, ...patch } : item) }));
    clearErrors(`backlogItems[${index}]`);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (submitting.current || !canEdit || !hasChanges) return;
    setSubmitError(null); const nextErrors = validateSampleContent(values, content); setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) { requestAnimationFrame(() => document.getElementById(sampleFieldId(first))?.focus()); return; }
    submitting.current = true; mutation.mutate(toSamplePayload(values, lockVersion));
  };

  return <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid min-w-0 gap-6">
    {submitError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to save sample content</AlertTitle><AlertDescription>{submitError.message}</AlertDescription></Alert>}
    <FieldError errors={errors.request ?? errors.lockVersion} />
    <section id={sampleFieldId("backlogItems")} tabIndex={-1} className="grid min-w-0 gap-4">
      <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5" />Sample backlog</CardTitle>
        <CardDescription className="mt-2">Prepare initial work and suggested roles for teams using this template.</CardDescription>
      </div><Badge variant="outline">{values.backlogItems.length} {values.backlogItems.length === 1 ? "item" : "items"}</Badge></div></CardHeader>
        <CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">Suggested roles describe who should handle the work. Teams assign individual members when planning their project.</p>
          {canEdit && <div className="flex flex-wrap gap-2"><TemplateBacklogImportDialog templateId={content.templateId}
            preview={previewImport} downloadTemplate={downloadImportTemplate}
            remaining={content.maxItems - values.backlogItems.length} maxImportBytes={content.maxImportBytes} disabled={disabled}
            onAppend={(items) => { setValues((current) => ({ ...current, backlogItems: [...current.backlogItems, ...items.map(newBacklogItem)] })); clearErrors("backlogItems"); }} />
            <Button type="button" variant="outline" disabled={disabled || values.backlogItems.length >= content.maxItems}
              onClick={() => { setValues((current) => ({ ...current, backlogItems: [...current.backlogItems, newBacklogItem()] })); clearErrors("backlogItems"); }}><Plus />Add backlog item</Button>
          </div>}<FieldError errors={errors.backlogItems} /></CardContent>
      </Card>
      {!values.backlogItems.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No sample backlog items yet.</p>}
      {values.backlogItems.map((item, index) => <TemplateBacklogEditor key={item.key} item={item} index={index} count={values.backlogItems.length}
        roles={content.roles} disabled={disabled} editable={canEdit} errors={errors} onChange={(patch) => changeBacklog(index, patch)}
        onMove={(direction) => { setValues((current) => ({ ...current, backlogItems: moved(current.backlogItems, index, direction) })); setErrors({}); }}
        onRemove={() => setRemoving({ key: item.key, title: item.title.trim() || "New backlog item" })} />)}
    </section>

    {canEdit && <div className="flex justify-end rounded-xl border bg-background p-3"><Button type="submit" disabled={disabled || !hasChanges}>
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}{mutation.isPending ? "Saving..." : "Save sample backlog"}
    </Button></div>}
    <ConfirmDialog open={!!removing} title="Remove this item?" description={`Remove "${removing?.title ?? ""}" from this template? The change is applied when you save the sample backlog.`}
      confirmLabel="Remove item" onCancel={() => setRemoving(null)} onConfirm={() => {
        if (!removing) return;
        setValues((current) => ({ ...current, backlogItems: current.backlogItems.filter((item) => item.key !== removing.key) }));
        setRemoving(null); setErrors({});
      }} />
  </form>;
}
