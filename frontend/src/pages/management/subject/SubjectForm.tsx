import { subjectApi } from "@/api/features/subject.api";
import { FormFieldRenderer } from "@/components/datatable/modal/form/FormFieldRenderer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EntitySchema, FieldSchema } from "@/types";
import type { SubjectDTO } from "@/types/features/subject";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { subjectDefaults, subjectPayload, validateSubject, type SubjectFormValues } from "./subject-form";

interface Props {
  open: boolean;
  onClose: (open: boolean) => void;
  initial: SubjectDTO | null;
  schema: EntitySchema;
  onSubmit: (values: Partial<SubjectDTO>) => void;
  busy: boolean;
  serverErrors: Record<string, string[]>;
  clearError: (name: string) => void;
  onClone?: (subject: SubjectDTO) => void;
}

export function SubjectForm({ open, onClose, initial, schema, onSubmit, busy, serverErrors, clearError, onClone }: Props) {
  const [values, setValues] = useState<SubjectFormValues>(() => subjectDefaults(initial));
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const usage = useQuery({
    queryKey: ["subject-usage", initial?.id], queryFn: () => subjectApi.getUsage(initial!.id!),
    enabled: open && Boolean(initial?.id), staleTime: 0,
  });
  useEffect(() => { setValues(subjectDefaults(initial)); setLocalErrors({}); }, [open, initial]);
  const locked = Boolean(initial && usage.data?.referenced);
  const checking = Boolean(initial && usage.isPending);
  const usageFailed = Boolean(initial && usage.isError);
  const errors = { ...serverErrors, ...localErrors };
  const field = (name: string) => schema.fields.find((item) => item.name === name)!;
  const renderField = (item: FieldSchema) => (
    <FormFieldRenderer key={item.name} field={item} value={values[item.name as keyof SubjectFormValues]}
      errorClass={errors[item.name]?.length ? "border-destructive focus-visible:ring-destructive" : ""}
      fieldErrors={errors[item.name]} onChange={(name, value) => {
        setValues((current) => ({ ...current, [name]: value }));
        setLocalErrors((current) => { const next = { ...current }; delete next[name]; return next; });
        clearError(name);
      }} />
  );
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) onClose(next); }}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{initial ? "Edit Subject" : "Create Subject"}</SheetTitle>
          <SheetDescription>{initial ? `${initial.code} · Version ${initial.version}` : "Define the subject and its learning content. Code, name, version and hours are required."}</SheetDescription>
        </SheetHeader>
        <form id="subject-form" className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (busy || checking || usageFailed) return;
          const nextErrors = locked ? {} : validateSubject(values);
          setLocalErrors(nextErrors);
          if (Object.keys(nextErrors).length) return;
          onSubmit(locked ? { isActive: values.isActive } : subjectPayload(values));
        }}>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {checking && <p role="status" className="text-sm text-muted-foreground">Checking where this version is used...</p>}
            {usageFailed && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
              <p>Unable to check subject usage. Retry before editing.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void usage.refetch()}>Retry</Button>
            </div>}
            {locked && <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
              <p>This version is already used by a program or study session. Its content is read-only. You can still change its status.</p>
              {onClone && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onClone(initial!)}>Clone to edit a new version</Button>}
            </div>}
            <fieldset disabled={busy || locked || checking || usageFailed} className="space-y-5 disabled:opacity-70">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold">Basic information</h2>
                <div className="grid gap-4 sm:grid-cols-2">{["code", "name", "version", "durationHours"].map((name) => renderField(field(name)))}</div>
                {renderField(field("technicalGroup"))}
                {renderField(field("description"))}
              </section>
              <section className="space-y-4 border-t pt-4">
                <h2 className="text-sm font-semibold">Learning content</h2>
                {renderField(field("objectives"))}
                {renderField(field("skills"))}
                {renderField(field("deliveryMode"))}
                {renderField(field("outline"))}
              </section>
            </fieldset>
            <fieldset disabled={busy || checking || usageFailed} className="border-t pt-4">
              {renderField(field("isActive"))}
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Inactive subjects are unavailable for new selections. Existing references remain intact.</p>
            </fieldset>
          </div>
          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || checking || usageFailed}>{busy ? "Saving..." : "Save subject"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
