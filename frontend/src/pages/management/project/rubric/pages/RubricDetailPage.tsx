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
import { AlertCircle, ArrowLeft, CopyPlus, Edit3, LockKeyhole, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { RubricStatusBadge } from "../components/RubricStatusBadge";
import {
  canCreateDraftFromVersion,
  canDeleteRubricVersion,
  canEditRubricVersion,
  canPublishRubricVersion,
  canUseRubricVersionInMilestone,
} from "../rubric-version-policy";

type Action = { type: "publish" | "delete"; version: RubricVersion };

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
      await rubricApi.deleteDraft(rubricId!, selected.version.id); return null;
    },
    onSuccess: async (result, selected) => {
      setAction(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["rubrics"] }),
        selected.type === "publish"
          ? client.invalidateQueries({ predicate: (cachedQuery) => cachedQuery.queryKey.at(-1) === "create-options" })
          : Promise.resolve(),
      ]);
      toast.success(selected.type === "publish" ? "Rubric version published and is now available to milestones." : "Draft deleted.");
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
            <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Version {version.versionNumber}</CardTitle>
                  <RubricStatusBadge status={version.status} />
                </div>
                <CardDescription className="mt-2">
                  {version.criteria.length} criteria · {version.totalMaxScore} maximum score · used by {version.milestoneUsageCount} milestone(s)
                </CardDescription>
                <p className={canUseRubricVersionInMilestone(version.status) ? "mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400" : "mt-2 text-xs text-amber-700 dark:text-amber-400"}>
                  {canUseRubricVersionInMilestone(version.status) ? <LockKeyhole className="size-3.5" /> : null}
                  {canUseRubricVersionInMilestone(version.status)
                    ? "Immutable and available to milestones"
                    : "Editable draft and not available to milestones"}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {canEditRubricVersion(version.status) && hasPermission("RUBRIC_UPDATE") ? <Button variant="outline" size="sm" asChild><Link to={`/rubrics/${rubric.id}/versions/${version.id}/edit`}><Edit3 /> Edit draft</Link></Button> : null}
                {canPublishRubricVersion(version.status) && hasPermission("RUBRIC_UPDATE") ? <Button size="sm" onClick={() => setAction({ type: "publish", version })}><Send /> Publish version</Button> : null}
                {canDeleteRubricVersion(version.status) && hasPermission("RUBRIC_DELETE") ? <Button variant="destructive" size="sm" onClick={() => setAction({ type: "delete", version })}><Trash2 /> Delete draft</Button> : null}
                {canCreateDraftFromVersion(version.status) && !hasDraft && hasPermission("RUBRIC_CREATE") ? <Button variant="outline" size="sm" disabled={newVersion.isPending} onClick={() => newVersion.mutate(version.id)}><CopyPlus /> Create new draft</Button> : null}
              </div>
            </CardHeader>
            <CardContent><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Code</TableHead><TableHead>Criterion and rating guidance</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Max score</TableHead></TableRow></TableHeader><TableBody>{version.criteria.map((criterion, index) => <TableRow key={criterion.id}><TableCell>{index + 1}</TableCell><TableCell className="font-mono text-xs">{criterion.code}</TableCell><TableCell><p className="font-medium">{criterion.name}</p>{criterion.description ? <p className="mt-1 text-xs text-muted-foreground">{criterion.description}</p> : null}<div className="mt-3 grid gap-1 text-xs">{criterion.ratings?.map((rating) => <div key={rating.id || rating.level} className="rounded bg-muted/40 px-2 py-1"><span className="font-medium">{rating.level.replace("_", " ")} ({rating.percentage}%):</span> <span className="text-muted-foreground">{rating.description}</span></div>)}</div></TableCell><TableCell className="text-right">{criterion.weight}%</TableCell><TableCell className="text-right">{criterion.maxScore}</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(action)}
        title={action?.type === "publish" ? `Publish version ${action.version.versionNumber}?` : "Delete this draft?"}
        description={action?.type === "publish" ? (
          <span className="grid gap-2">
            <span>{action.version.criteria.length} criteria · {action.version.totalMaxScore} total points · {action.version.criteria.reduce((count, criterion) => count + criterion.ratings.length, 0)} rating guidance entries.</span>
            <span>After publishing, this version becomes immutable and can be selected by milestones. Future changes require a new draft version.</span>
          </span>
        ) : "This action permanently deletes the draft. Published versions are not affected."}
        confirmLabel={action?.type === "publish" ? "Publish version" : "Delete draft"}
        loadingLabel={action?.type === "publish" ? "Publishing..." : "Deleting..."}
        destructive={action?.type !== "publish"}
        loading={actionMutation.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() => action && actionMutation.mutate(action)}
      />
    </MainLayout>
  );
}
