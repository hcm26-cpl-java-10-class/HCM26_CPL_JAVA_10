import { rubricApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { RubricDetail, RubricVersion } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Archive, ArrowLeft, CopyPlus, Edit3, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { RubricStatusBadge } from "../components/RubricStatusBadge";

type Action = { type: "publish" | "archive" | "delete"; version: RubricVersion };

export function RubricDetailPage() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { hasPermission } = usePermissions();
  const [action, setAction] = useState<Action | null>(null);
  const query = useQuery({ queryKey: ["rubrics", rubricId], queryFn: () => rubricApi.getDetail(rubricId!), enabled: Boolean(rubricId), retry: false });
  const actionMutation = useMutation({
    mutationFn: async (selected: Action): Promise<RubricDetail | null> => {
      if (selected.type === "publish") return rubricApi.publish(rubricId!, selected.version.id);
      if (selected.type === "archive") return rubricApi.archive(rubricId!, selected.version.id);
      await rubricApi.deleteDraft(rubricId!, selected.version.id); return null;
    },
    onSuccess: async (result, selected) => {
      setAction(null); await client.invalidateQueries({ queryKey: ["rubrics"] });
      toast.success(selected.type === "publish" ? "Rubric version published." : selected.type === "archive" ? "Rubric version archived." : "Draft deleted.");
      if (result) client.setQueryData(["rubrics", rubricId], result);
      else if (query.data?.versions.length === 1) navigate("/rubrics");
      else void query.refetch();
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Rubric action failed."),
  });
  const newVersion = useMutation({
    mutationFn: (sourceId: string) => rubricApi.createVersion(rubricId!, sourceId),
    onSuccess: async (result) => { await client.invalidateQueries({ queryKey: ["rubrics"] }); const draft = result.versions.find((item) => item.status === "DRAFT"); toast.success("New draft version created."); navigate(draft ? `/rubrics/${rubricId}/versions/${draft.id}/edit` : `/rubrics/${rubricId}`); },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not create a new version."),
  });

  if (query.isLoading) return <MainLayout pathName={{ rubrics: "Rubrics", detail: "Detail" }}><div className="p-8 text-center">Loading rubric…</div></MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ rubrics: "Rubrics", detail: "Detail" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load rubric</AlertTitle><AlertDescription><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Try again</Button></AlertDescription></Alert></MainLayout>;
  const rubric = query.data;
  const hasDraft = rubric.versions.some((version) => version.status === "DRAFT");

  return (
    <MainLayout pathName={{ rubrics: "Rubrics", [rubric.id]: rubric.name }}>
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Button variant="ghost" className="mb-2 -ml-3" asChild><Link to="/rubrics"><ArrowLeft /> Back to rubrics</Link></Button><h1 className="text-2xl font-semibold">{rubric.name}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{rubric.description || "No description provided."}</p></div><div className="text-sm text-muted-foreground">{rubric.versions.length} version{rubric.versions.length === 1 ? "" : "s"}</div></div>
        {rubric.versions.map((version) => (
          <Card key={version.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-2"><CardTitle>Version {version.versionNumber}</CardTitle><RubricStatusBadge status={version.status} /></div><CardDescription className="mt-2">{version.criteria.length} criteria · {version.totalMaxScore} maximum score · used by {version.milestoneUsageCount} milestone(s)</CardDescription></div>
              <div className="flex flex-wrap justify-end gap-2">
                {version.status === "DRAFT" && hasPermission("RUBRIC_UPDATE") ? <Button variant="outline" size="sm" asChild><Link to={`/rubrics/${rubric.id}/versions/${version.id}/edit`}><Edit3 /> Edit</Link></Button> : null}
                {version.status === "DRAFT" && hasPermission("RUBRIC_UPDATE") ? <Button size="sm" onClick={() => setAction({ type: "publish", version })}><Send /> Publish</Button> : null}
                {version.status === "DRAFT" && hasPermission("RUBRIC_DELETE") ? <Button variant="destructive" size="sm" onClick={() => setAction({ type: "delete", version })}><Trash2 /> Delete</Button> : null}
                {version.status === "PUBLISHED" && hasPermission("RUBRIC_UPDATE") ? <Button variant="outline" size="sm" onClick={() => setAction({ type: "archive", version })}><Archive /> Archive</Button> : null}
                {version.status !== "DRAFT" && !hasDraft && hasPermission("RUBRIC_CREATE") ? <Button variant="outline" size="sm" disabled={newVersion.isPending} onClick={() => newVersion.mutate(version.id)}><CopyPlus /> New version</Button> : null}
              </div>
            </CardHeader>
            <CardContent><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Code</TableHead><TableHead>Criterion and rating guidance</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Max score</TableHead></TableRow></TableHeader><TableBody>{version.criteria.map((criterion, index) => <TableRow key={criterion.id}><TableCell>{index + 1}</TableCell><TableCell className="font-mono text-xs">{criterion.code}</TableCell><TableCell><p className="font-medium">{criterion.name}</p>{criterion.description ? <p className="mt-1 text-xs text-muted-foreground">{criterion.description}</p> : null}<div className="mt-3 grid gap-1 text-xs">{criterion.ratings?.map((rating) => <div key={rating.id || rating.level} className="rounded bg-muted/40 px-2 py-1"><span className="font-medium">{rating.level.replace("_", " ")} ({rating.percentage}%):</span> <span className="text-muted-foreground">{rating.description}</span></div>)}</div></TableCell><TableCell className="text-right">{criterion.weight}%</TableCell><TableCell className="text-right">{criterion.maxScore}</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog open={Boolean(action)} title={action?.type === "publish" ? "Publish this rubric version?" : action?.type === "archive" ? "Archive this rubric version?" : "Delete this draft?"} description={action?.type === "publish" ? "Published criteria become immutable and can be selected by new milestones." : action?.type === "archive" ? "New milestones will no longer be able to select it. Existing milestones keep access." : "This action permanently deletes the unused draft."} confirmLabel={action?.type === "publish" ? "Publish" : action?.type === "archive" ? "Archive" : "Delete draft"} loading={actionMutation.isPending} onCancel={() => setAction(null)} onConfirm={() => action && actionMutation.mutate(action)} />
    </MainLayout>
  );
}
