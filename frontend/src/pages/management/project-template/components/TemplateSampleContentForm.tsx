import { projectTemplateApi } from "@/api/features/project-template.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import type { TemplateSampleContent, TemplateSampleContentPayload, TemplateBacklogInput } from "@/types/features/project-template";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, ClipboardList, Loader2, PanelLeftClose, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";
import { useTemplateDraft } from "../hooks/useTemplateDraft";
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
  const formId = useId();
  const fieldId = useCallback((path: string) => `${formId}-${sampleFieldId(path)}`, [formId]);
  const contentValues = useMemo(() => toSampleValues(content), [content]);
  const { values, setValues, hasChanges, lockVersion, acceptSaved } = useTemplateDraft(
    contentValues, content.lockVersion, values => JSON.stringify(toSamplePayload(values, 0).backlogItems),
  );
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<SampleContentErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const [removing, setRemoving] = useState<{ key: string; title: string } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const focusError = useRef<string | null>(null);
  const submitting = useRef(false);
  const { backlogItems } = values;
  const activeIndex = backlogItems.findIndex((item) => item.key === activeKey);
  const activeItem = backlogItems[activeIndex];

  function showErrors(nextErrors: SampleContentErrors) {
    const firstError = Object.keys(nextErrors)[0];
    const index = firstError?.match(/^backlogItems\[(\d+)\]/)?.[1];
    const invalidItem = index == null ? undefined : backlogItems[Number(index)];
    if (invalidItem) setActiveKey(invalidItem.key);
    focusError.current = firstError ?? null;
    setErrors(nextErrors);
  }

  useEffect(() => {
    const path = focusError.current;
    if (!path) return;
    const target = document.getElementById(fieldId(path))
      ?? (path.startsWith("backlogItems[") ? editor.current : document.getElementById(fieldId("backlogItems")));
    target?.focus();
    focusError.current = null;
  }, [errors, fieldId]);

  const mutation = useMutation({ mutationFn: (payload: TemplateSampleContentPayload) => save ? save(payload) : projectTemplateApi.saveSampleContent(content.templateId, payload),
    onSuccess: (saved) => {
      acceptSaved(toSampleValues(saved), saved.lockVersion);
      setActiveKey(null);
      setErrors({}); setSubmitError(null);
      onSaved(saved); toast.success("Sample backlog saved successfully.");
    },
    onError: (error) => {
      const result = getTemplateError(error);
      showErrors(result.fields);
      setSubmitError(result);
    },
    onSettled: () => { submitting.current = false; },
  });
  const canEdit = editable && content.editable;
  const disabled = !canEdit || mutation.isPending;
  const clearErrors = (prefix: string) => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith(prefix))));
  const changeBacklog = (index: number, patch: Partial<BacklogItemValues>) => {
    setValues((current) => ({ ...current, backlogItems: current.backlogItems.map((item, i) => i === index ? { ...item, ...patch } : item) }));
    clearErrors(`backlogItems[${index}]`);
  };
  const openItem = (key: string) => {
    setActiveKey(key);
    requestAnimationFrame(() => editor.current?.scrollIntoView({ block: "start" }));
  };
  const collapseItem = () => {
    setActiveKey(null);
    document.getElementById(fieldId("backlogItems"))?.focus();
  };
  const appendItems = (items: BacklogItemValues[]) => {
    setValues((current) => ({ ...current, backlogItems: [...current.backlogItems, ...items] }));
    clearErrors("backlogItems");
  };
  const addItem = () => {
    const item = newBacklogItem();
    appendItems([item]);
    openItem(item.key);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !canEdit || !hasChanges) return;
    setSubmitError(null);
    const nextErrors = validateSampleContent(values, content);
    if (Object.keys(nextErrors).length) {
      showErrors(nextErrors);
      return;
    }
    setErrors({});
    submitting.current = true;
    mutation.mutate(toSamplePayload(values, lockVersion));
  };

  return <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid min-w-0 gap-4">
    {submitError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to save sample content</AlertTitle><AlertDescription>{submitError.message}</AlertDescription></Alert>}
    <Card className="overflow-hidden pt-0">
      <CardHeader className="border-b bg-indigo-50/50 pt-5 dark:bg-indigo-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-indigo-600 dark:text-indigo-400" />Sample backlog</CardTitle>
            <CardDescription className="mt-2">Prepare initial work for teams using this template.</CardDescription>
          </div>
          <Badge variant="outline">{backlogItems.length} {backlogItems.length === 1 ? "item" : "items"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
      </CardContent>
    </Card>

    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <Card id={fieldId("backlogItems")} tabIndex={-1} className="gap-3 xl:sticky xl:top-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Backlog list</CardTitle>
          <CardDescription>Select an item to open its details.</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3 px-4">
          {(errors.backlogItems || errors.request || errors.lockVersion) && (
            <div aria-live="polite"><FieldError errors={errors.backlogItems ?? errors.request ?? errors.lockVersion} /></div>
          )}
          {backlogItems.length > 0 && <ol className="grid max-h-[45vh] gap-2 overflow-y-auto p-0.5">
            {backlogItems.map((item, index) => {
              const selected = item.key === activeKey;
              const path = `backlogItems[${index}]`;
              const invalid = Object.keys(errors).some((field) => field === path || field.startsWith(`${path}.`));
              return <li key={item.key}>
                <button type="button" aria-expanded={selected} aria-controls={fieldId("editor")}
                  className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/60" : "hover:bg-muted/40"}`}
                  onClick={() => selected ? collapseItem() : openItem(item.key)}>
                  <span className="shrink-0 font-medium text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{item.title.trim() || "New backlog item"}</span>
                    {invalid && <span className="mt-1 block text-xs text-destructive">Check details</span>}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>;
            })}
          </ol>}
          {canEdit && <>
            <Button type="button" variant="outline" className="border-dashed" disabled={disabled || backlogItems.length >= content.maxItems}
              onClick={addItem}><Plus />Add backlog item</Button>
            <TemplateBacklogImportDialog templateId={content.templateId} preview={previewImport} downloadTemplate={downloadImportTemplate}
              remaining={content.maxItems - backlogItems.length} maxImportBytes={content.maxImportBytes} disabled={disabled}
              onAppend={(items) => appendItems(items.map(newBacklogItem))} />
            <Button type="submit" disabled={disabled || !hasChanges}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {mutation.isPending ? "Saving..." : "Save sample backlog"}
            </Button>
            {hasChanges && <p className="text-xs text-muted-foreground" role="status">Unsaved changes</p>}
          </>}
        </CardContent>
      </Card>
      <div ref={editor} id={fieldId("editor")} tabIndex={-1} className="grid min-w-0 gap-3 scroll-mt-4">
        {activeItem ? <>
          <TemplateBacklogEditor key={activeItem.key} item={activeItem} index={activeIndex} count={backlogItems.length}
            disabled={disabled} editable={canEdit} errors={errors} fieldId={fieldId} onChange={(patch) => changeBacklog(activeIndex, patch)}
            onMove={(direction) => {
              setValues((current) => ({ ...current, backlogItems: moved(current.backlogItems, activeIndex, direction) }));
              setErrors({});
            }}
            onRemove={() => setRemoving({ key: activeItem.key, title: activeItem.title.trim() || "New backlog item" })}
            onCollapse={collapseItem} />
          <Button type="button" variant="outline" className="w-fit justify-self-end" onClick={collapseItem}>
            <PanelLeftClose />Back to backlog list
          </Button>
        </> : <div className="rounded-xl border border-dashed p-8 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">{backlogItems.length ? "Select a backlog item" : "No sample backlog items yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{backlogItems.length ? "Open an item from the list to see its details."
            : canEdit ? "Add or import the first item to get started." : "A sample backlog has not been configured."}</p>
        </div>}
      </div>
    </div>
    <ConfirmDialog open={!!removing} title="Remove this item?" description={`Remove "${removing?.title ?? ""}" from this template? The change is applied when you save the sample backlog.`}
      confirmLabel="Remove item" onCancel={() => setRemoving(null)} onConfirm={() => {
        if (!removing) return;
        setValues((current) => ({ ...current, backlogItems: current.backlogItems.filter((item) => item.key !== removing.key) }));
        if (removing.key === activeKey) collapseItem();
        setRemoving(null); setErrors({});
      }} />
  </form>;
}
