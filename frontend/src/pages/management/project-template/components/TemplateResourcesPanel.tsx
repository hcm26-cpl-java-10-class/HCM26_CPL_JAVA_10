import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { templateResourceApi, type TemplateResourceListing } from "@/api/features/template-resource.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { getTemplateError } from "../project-template.utils";

export function TemplateResourcesPanel({ templateId, editable, versionId }: {
  templateId: number; editable: boolean; versionId?: number;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const key = ["template-resources", user.email, activeRole, templateId, versionId];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => templateResourceApi.list(templateId, versionId, signal),
    retry: false, refetchOnWindowFocus: false });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const pending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canEdit = editable && query.data?.editable === true;

  async function change(action: () => Promise<TemplateResourceListing>) {
    if (pending.current || !canEdit) return;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      client.setQueryData(key, await action());
      setTitle(""); setUrl("");
      await Promise.all([client.invalidateQueries({ queryKey: ["project-templates"] }),
        client.invalidateQueries({ queryKey: ["project-template-versions"] })]);
    } catch (error) { setError(getTemplateError(error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  function upload(file?: File) {
    if (!file || !query.data) return;
    if (file.size > 25 * 1024 * 1024) { setError("File exceeds the maximum allowed size (25 MB per file)"); return; }
    if (!/\.(pdf|docx|xlsx|csv|zip)$/i.test(file.name)) { setError("Supported file types: PDF, DOCX, XLSX, CSV and ZIP"); return; }
    if (!file.size) { setError("Choose a non-empty file"); return; }
    void change(() => templateResourceApi.upload(templateId, file, query.data!.lockVersion, versionId));
  }

  async function download(resourceId: number, name: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      const blob = await templateResourceApi.download(templateId, resourceId, versionId);
      const link = document.createElement("a"); const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) { setError(getTemplateError(error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;

  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Resources</CardTitle>
      {canEdit && <><Input ref={fileInput} type="file" accept=".pdf,.docx,.xlsx,.csv,.zip" className="hidden"
        aria-label="Upload template resource" disabled={busy}
        onChange={event => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}Upload file</Button></>}
    </div><CardDescription>Reference documents and repository links. PDF, DOCX, XLSX, CSV and ZIP files, up to 25 MB each.</CardDescription></CardHeader>
    <CardContent className="grid gap-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!query.data.resources.length ? <p className="text-sm text-muted-foreground">No resources configured.</p>
        : <ul className="divide-y rounded-lg border">{query.data.resources.map(resource => <li key={resource.id}
          className="flex items-start justify-between gap-3 p-3"><div className="flex min-w-0 gap-2">
          {resource.kind === "FILE" ? <FileText className="mt-0.5 size-4 shrink-0" /> : <Link2 className="mt-0.5 size-4 shrink-0" />}
          <div className="min-w-0"><p className="break-words text-sm font-medium">{resource.title}</p>
            <p className="break-all text-xs text-muted-foreground">{resource.kind === "FILE"
              ? `${((resource.sizeBytes ?? 0) / 1024).toFixed(1)} KB` : resource.url}</p></div></div>
          <div className="flex shrink-0 gap-1">{resource.kind === "FILE" ? <Button variant="ghost" size="icon-sm" disabled={busy}
            aria-label={`Download ${resource.title}`} onClick={() => void download(resource.id, resource.fileName ?? resource.title)}><Download /></Button>
            : resource.url && <Button variant="ghost" size="icon-sm" asChild><a href={resource.url} target="_blank" rel="noopener noreferrer"
              aria-label={`Open ${resource.title}`}><ExternalLink /></a></Button>}
            {canEdit && <Button variant="ghost" size="icon-sm" className="text-destructive" disabled={busy}
              aria-label={`Remove ${resource.title}`} onClick={() => void change(() => templateResourceApi.remove(
                templateId, resource.id, query.data!.lockVersion, versionId))}><Trash2 /></Button>}</div>
        </li>)}</ul>}
      {canEdit && <form className="grid gap-3 rounded-lg border p-4" onSubmit={event => {
        event.preventDefault();
        if (!title.trim() || !/^https:\/\//i.test(url.trim())) { setError("Enter a title and a valid HTTPS resource link"); return; }
        void change(() => templateResourceApi.addLink(templateId, title.trim(), url.trim(), query.data!.lockVersion, versionId));
      }}><div className="grid gap-2"><Label htmlFor="template-resource-title">Link title</Label>
        <Input id="template-resource-title" value={title} maxLength={255} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="E.g. Git template" /></div>
        <div className="grid gap-2"><Label htmlFor="template-resource-url">Resource URL</Label>
          <Input id="template-resource-url" type="url" value={url} maxLength={2000} disabled={busy} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/organization/template" /></div>
        <Button type="submit" variant="outline" disabled={busy || !title.trim() || !url.trim()} className="justify-self-end"><Plus />Add link</Button>
      </form>}
    </CardContent>
  </Card>;
}
