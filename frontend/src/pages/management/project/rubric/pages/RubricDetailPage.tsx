import { rubricApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import type { RubricDetail, RubricVersion } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, CopyPlus, FileEdit, Flag, ListChecks, LockKeyhole, PencilLine, Send, Trash2, Trophy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RubricCriterionCard } from "../components/RubricCriterionCard";
import { RubricDetailSkeleton } from "../components/RubricDetailSkeleton";
import { RubricStatusBadge } from "../components/RubricStatusBadge";
import { RubricWeightBar } from "../components/RubricWeightBar";
import {
  canCreateDraftFromVersion,
  canDeleteRubricVersion,
  canEditRubricVersion,
  canPublishRubricVersion,
  canUseRubricVersionInMilestone,
} from "../rubric-version-policy";

const BREADCRUMB = { rubrics: "Rubrics", detail: "Detail" };

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

function StatTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-semibold">{value}</div>
        {hint ? <div className="truncate text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

export function RubricDetailPage() {
  const { rubricId } = useParams<{ rubricId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<"publish" | "delete" | null>(null);

  const query = useQuery({
    queryKey: ["rubrics", rubricId],
    queryFn: () => rubricApi.getDetail(rubricId!),
    enabled: Boolean(rubricId),
    retry: false,
  });
  const rubric = query.data;

  const versions = useMemo(
    () => [...(rubric?.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber),
    [rubric],
  );
  const requestedVersion = Number(searchParams.get("version"));
  const version: RubricVersion | undefined =
    versions.find((item) => item.versionNumber === requestedVersion) ?? versions[0];
  const criteria = useMemo(
    () => [...(version?.criteria ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [version],
  );

  const selectVersion = (versionNumber: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("version", String(versionNumber));
      return next;
    }, { replace: true });
    setCollapsed(new Set());
  };

  const refresh = (result?: RubricDetail) => {
    if (result) queryClient.setQueryData(["rubrics", rubricId], result);
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rubrics"] }),
      queryClient.invalidateQueries({ predicate: (item) => item.queryKey.at(-1) === "create-options" }),
    ]);
  };

  const publishMutation = useMutation({
    mutationFn: (target: RubricVersion) => rubricApi.publish(rubricId!, target.id),
    onSuccess: async (result) => {
      setConfirm(null);
      await refresh(result);
      toast.success("Rubric version published and is now available to milestones.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not publish the rubric draft.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (target: RubricVersion) => rubricApi.deleteDraft(rubricId!, target.id),
    onSuccess: async () => {
      const deletedWholeRubric = versions.length === 1;
      setConfirm(null);
      if (deletedWholeRubric) {
        queryClient.removeQueries({ queryKey: ["rubrics", rubricId] });
        await queryClient.invalidateQueries({ queryKey: ["rubrics"] });
        toast.success("Rubric deleted.");
        navigate("/rubrics", { replace: true });
        return;
      }
      await refresh();
      setSearchParams({}, { replace: true });
      toast.success("Draft version deleted.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not delete the rubric draft.")),
  });

  const newVersionMutation = useMutation({
    mutationFn: (source: RubricVersion) => rubricApi.createVersion(rubricId!, source.id),
    onSuccess: async (result) => {
      await refresh(result);
      const draft = result.versions.find((item) => item.status === "DRAFT");
      toast.success("New draft version created.");
      if (draft) navigate(`/rubrics/${rubricId}/versions/${draft.id}/edit`);
    },
    onError: (error) => toast.error(errorMessage(error, "Could not create a new draft version.")),
  });

  if (query.isLoading) {
    return <MainLayout pathName={BREADCRUMB}><RubricDetailSkeleton /></MainLayout>;
  }
  if (query.isError || !rubric) {
    return (
      <MainLayout pathName={BREADCRUMB}>
        <Alert variant="destructive" className="mx-auto max-w-6xl">
          <AlertCircle />
          <AlertTitle>Could not load rubric</AlertTitle>
          <AlertDescription>
            <p>{errorMessage(query.error, "The rubric may have been deleted or you may not have access to it.")}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
              <Button variant="ghost" asChild><Link to="/rubrics">Back to rubrics</Link></Button>
            </div>
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  const hasDraft = versions.some((item) => item.status === "DRAFT");
  const busy = publishMutation.isPending || deleteMutation.isPending || newVersionMutation.isPending;
  const allCollapsed = criteria.length > 0 && criteria.every((item) => collapsed.has(item.id));
  const toggleCriterion = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const usable = version ? canUseRubricVersionInMilestone(version.status) : false;

  return (
    <MainLayout pathName={{ rubrics: "Rubrics", [rubric.id]: rubric.name }}>
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-4">
        {/* Header */}
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3" asChild>
              <Link to="/rubrics"><ArrowLeft /> Back to rubrics</Link>
            </Button>
            <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{rubric.name}</h1>
            <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {rubric.description || "No description provided."}
            </p>
          </div>
          {version ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              {canEditRubricVersion(version.status) ? (
                <Button variant="outline" disabled={busy} asChild>
                  <Link to={`/rubrics/${rubric.id}/versions/${version.id}/edit`}><PencilLine /> Edit draft</Link>
                </Button>
              ) : null}
              {canDeleteRubricVersion(version.status) ? (
                <Button variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setConfirm("delete")}>
                  <Trash2 /> Delete draft
                </Button>
              ) : null}
              {canPublishRubricVersion(version.status) ? (
                <Button disabled={busy || criteria.length === 0} onClick={() => setConfirm("publish")}>
                  <Send /> Publish
                </Button>
              ) : null}
              {canCreateDraftFromVersion(version.status) && !hasDraft ? (
                <Button variant="outline" disabled={busy} onClick={() => newVersionMutation.mutate(version)}>
                  <CopyPlus /> {newVersionMutation.isPending ? "Creating..." : "Create new version"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!version ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">This rubric has no versions yet.</CardContent></Card>
        ) : (
          <>
            {/* Version selector */}
            {versions.length > 1 ? (
              <div className="min-w-0 overflow-x-auto">
                <div role="tablist" aria-label="Rubric versions" className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1">
                  {versions.map((item) => {
                    const selected = item.id === version.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => selectVersion(item.versionNumber)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${selected ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        v{item.versionNumber}
                        <span className={`size-1.5 rounded-full ${item.status === "PUBLISHED" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
                        <span className="sr-only">{item.status}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Status banner */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${usable ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}>
              <span className="flex items-center gap-2 font-medium">
                {usable ? <LockKeyhole className="size-4" /> : <FileEdit className="size-4" />}
                Version {version.versionNumber}
              </span>
              <RubricStatusBadge status={version.status} />
              <span>
                {usable
                  ? "Immutable and available to milestones. Create a new version to make changes."
                  : "Editable draft. Publish it to make it available to milestones."}
              </span>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile icon={<Trophy className="size-4" />} label="Max score" value={version.totalMaxScore} hint="points" />
              <StatTile icon={<ListChecks className="size-4" />} label="Criteria" value={criteria.length} />
              <StatTile icon={<Flag className="size-4" />} label="Used by" value={version.milestoneUsageCount} hint={`milestone${version.milestoneUsageCount === 1 ? "" : "s"}`} />
              <StatTile
                icon={<CalendarClock className="size-4" />}
                label={version.publishedAt ? "Published" : "Last updated"}
                value={<span className="text-sm">{formatDate(version.publishedAt ?? version.updatedAt)}</span>}
              />
            </div>

            {/* Weight distribution */}
            {criteria.length ? (
              <Card className="py-4"><CardContent className="px-5"><RubricWeightBar criteria={criteria} /></CardContent></Card>
            ) : null}

            {/* Criteria */}
            <section className="grid min-w-0 gap-2" aria-label="Criteria">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Criteria & rating guidance</h2>
                {criteria.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(criteria.map((item) => item.id)))}
                  >
                    {allCollapsed ? "Expand all" : "Collapse all"}
                  </Button>
                ) : null}
              </div>
              {criteria.length ? (
                criteria.map((criterion, index) => (
                  <RubricCriterionCard
                    key={criterion.id}
                    criterion={criterion}
                    index={index}
                    open={!collapsed.has(criterion.id)}
                    onToggle={() => toggleCriterion(criterion.id)}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    This version has no criteria yet.
                    {canEditRubricVersion(version.status) ? (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/rubrics/${rubric.id}/versions/${version.id}/edit`}><PencilLine /> Add criteria</Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "publish"}
        title={`Publish version ${version?.versionNumber ?? ""}?`}
        description={version ? (
          <span className="grid gap-2">
            <span>{criteria.length} criteria · {version.totalMaxScore} total points.</span>
            <span>Publishing makes this version immutable and immediately available to milestones. Future changes require a new draft version.</span>
          </span>
        ) : undefined}
        confirmLabel="Publish version"
        loadingLabel="Publishing..."
        destructive={false}
        loading={publishMutation.isPending}
        onCancel={() => !publishMutation.isPending && setConfirm(null)}
        onConfirm={() => { if (version) publishMutation.mutate(version); }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={versions.length === 1 ? "Delete this rubric?" : `Delete draft version ${version?.versionNumber ?? ""}?`}
        description={versions.length === 1
          ? "This is the rubric's only version, so deleting the draft will permanently delete the entire rubric."
          : "Only this draft version will be deleted. Published versions remain available to milestones."}
        confirmLabel={versions.length === 1 ? "Delete rubric" : "Delete draft"}
        loading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setConfirm(null)}
        onConfirm={() => { if (version) deleteMutation.mutate(version); }}
      />
    </MainLayout>
  );
}
