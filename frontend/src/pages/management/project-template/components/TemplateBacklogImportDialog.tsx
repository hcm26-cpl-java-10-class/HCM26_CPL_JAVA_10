import { projectTemplateApi } from "@/api/features/project-template.api";
import { ImportTab } from "@/components/datatable/dataio/ImportTab";
import { ImportResultContent } from "@/components/datatable/dataio/ImportResultModal";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import type { ImportResult } from "@/types";
import type { TemplateBacklogInput } from "@/types/features/project-template";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";

export function TemplateBacklogImportDialog({ templateId, remaining, maxImportBytes, disabled, onAppend }: {
  templateId: number; remaining: number; maxImportBytes: number; disabled: boolean; onAppend: (items: TemplateBacklogInput[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const pending = useRef(false);
  const onImport = async (file: File) => {
    if (pending.current || disabled) return;
    pending.current = true; setLoading(true); setResult(null);
    try {
      const items = await projectTemplateApi.previewBacklogImport(templateId, file);
      if (items.length > remaining) throw new Error(`Only ${remaining} more backlog items can be added to this template`);
      onAppend(items); setOpen(false);
      toast.success(`${items.length} backlog items added to the form. Save sample content to keep them.`);
    } catch (error) {
      const response = getTemplateError(error);
      const errors = Object.entries(response.fields).flatMap(([field, messages]) => {
        const match = /^rows\[(\d+)\]/.exec(field);
        return match ? messages.map((message) => ({ rowNumber: Number(match[1]), message })) : [];
      });
      if (errors.length) setResult({ successCount: 0, failureCount: new Set(errors.map((row) => row.rowNumber)).size, errors });
      if (error instanceof Error && response.status === undefined) toast.error(error.message);
      throw error;
    } finally { pending.current = false; setLoading(false); }
  };

  return <>
    <Button type="button" variant="outline" disabled={disabled || remaining <= 0} onClick={() => { setResult(null); setOpen(true); }}><Upload />Import backlog</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!loading) setOpen(value); }}>
      <DialogContent showCloseButton={!loading} className="flex max-h-[90vh] min-h-105 flex-col overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Import sample backlog</DialogTitle><DialogDescription>
          Use Title, Description and SuggestedRole columns. Roles: PM, BA, DEV, QA. All rows must be valid before they are added to the form.
        </DialogDescription></DialogHeader>
        <Tabs defaultValue="import" className="flex flex-1 flex-col"><ImportTab loading={loading} onImport={onImport} maxFileSize={maxImportBytes}
          onDownloadTemplate={async () => downloadBlob(await projectTemplateApi.getBacklogImportTemplate(templateId), "template-backlog.xlsx")} /></Tabs>
        {result && <div className="grid gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">No rows were added. Correct the file and try again.</p><ImportResultContent result={result} /></div>}
        <DialogFooter><Button type="button" variant="outline" disabled={loading} onClick={() => setOpen(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
