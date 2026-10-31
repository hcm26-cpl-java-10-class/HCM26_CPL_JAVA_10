import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { CreateMilestoneRequest, MilestoneApiError, MilestoneDetailRouteState } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MilestoneForm } from "../components/MilestoneForm";
import { MilestoneActiveEditForm } from "../components/MilestoneActiveEditForm";
import { milestoneDefaultValues, type MilestoneFormValues } from "../milestone-form.schema";
import {
  buildMilestonePayload,
  getMilestoneApiError,
  isNetworkOrTimeoutError,
  stablePayload,
  toDateTimeLocal,
} from "../milestone.utils";

interface SubmissionAttempt {
  key: string;
  serializedPayload: string;
  payload: CreateMilestoneRequest;
}

function CreatePageSkeleton() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></CardHeader>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-6">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function MilestoneCreatePage() {
  const { projectId, teamId: routeTeamId, milestoneId } = useParams<{ projectId?: string; teamId?: string; milestoneId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = Number(routeTeamId ?? searchParams.get("teamId"));
  const scopedTeamId = Number.isSafeInteger(teamId) && teamId > 0 ? teamId : undefined;
  const teamScoped = scopedTeamId !== undefined
    && (routeTeamId !== undefined || searchParams.get("scope") === "team");
  const workspaceId = Number(searchParams.get("workspaceId"));
  const scopedWorkspaceId = Number.isSafeInteger(workspaceId) && workspaceId > 0 ? workspaceId : undefined;
  const listUrl = teamScoped && scopedWorkspaceId
    ? `/management/workspaces/${scopedWorkspaceId}?tab=milestones`
    : projectId
    ? `/projects/${projectId}/milestones${scopedTeamId ? `?teamId=${scopedTeamId}` : ""}`
    : teamScoped ? "/milestones/teams" : "/teacher";
  const queryClient = useQueryClient();
  const [isDirty, setDirty] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [apiError, setApiError] = useState<MilestoneApiError | null>(null);
  const [networkUncertain, setNetworkUncertain] = useState(false);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const completedRef = useRef(false);

  const existingQuery = useQuery({
    queryKey: ["milestone-edit", projectId, scopedTeamId, milestoneId],
    queryFn: () => teamScoped || !projectId
      ? milestoneApi.getTeamDetail(scopedTeamId!, milestoneId!)
      : milestoneApi.getDetail(projectId, milestoneId!, scopedTeamId),
    enabled: !!milestoneId && (teamScoped || !!projectId),
  });
  const optionsQuery = useQuery({
    queryKey: teamScoped
      ? ["teams", scopedTeamId, "milestones", "create-options"]
      : ["projects", projectId, "milestones", "create-options"],
    queryFn: () => teamScoped
      ? milestoneApi.getTeamCreateOptions(scopedTeamId!)
      : milestoneApi.getCreateOptions(projectId as string),
    enabled: (teamScoped || !!projectId) && (!milestoneId || existingQuery.data?.lifecycleStatus === "PLANNED"),
    retry: false,
  });

  const defaultValues = useMemo<MilestoneFormValues>(() => ({
    ...milestoneDefaultValues,
    checklist: milestoneDefaultValues.checklist.map((item) => ({ ...item })),
    latePolicy: { ...milestoneDefaultValues.latePolicy },
    resubmissionPolicy: { ...milestoneDefaultValues.resubmissionPolicy },
    ...(existingQuery.data ? {
      title: existingQuery.data.title,
      description: existingQuery.data.description ?? "",
      deadline: toDateTimeLocal(existingQuery.data.deadline),
      startDate: existingQuery.data.startDate ?? "",
      mandatory: existingQuery.data.mandatory,
      checklist: existingQuery.data.checklist.map(item => ({ content: item.content, mandatory: item.mandatory })),
      rubricSnapshotId: existingQuery.data.rubric?.snapshotId ?? "",
      latePolicy: { type: existingQuery.data.latePolicy.type ?? "NO_LATE", lateUntil: toDateTimeLocal(existingQuery.data.latePolicy.lateUntil) || undefined, penaltyPercent: existingQuery.data.latePolicy.penaltyPercent ?? undefined },
      resubmissionPolicy: { allowed: existingQuery.data.resubmissionPolicy.allowed, maxAttempts: existingQuery.data.resubmissionPolicy.maxAttempts ?? undefined },
    } : {}),
    rubricSnapshotId: existingQuery.data?.rubric?.snapshotId ?? (optionsQuery.data?.rubrics.length === 1 ? optionsQuery.data.rubrics[0].id : ""),
  }), [optionsQuery.data, existingQuery.data]);

  const createMutation = useMutation({
    mutationFn: (attempt: SubmissionAttempt) =>
      teamScoped
        ? milestoneApi.createForTeam(scopedTeamId!, attempt.payload, attempt.key)
        : milestoneApi.create(projectId as string, attempt.payload, attempt.key),
    onSuccess: async (milestone) => {
      completedRef.current = true;
      attemptRef.current = null;
      setApiError(null);
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] });
      await queryClient.invalidateQueries({ queryKey: ["milestone", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-milestones", projectId, scopedTeamId] });
      await queryClient.invalidateQueries({ queryKey: ["team-milestones", scopedTeamId] });
      const rubric = optionsQuery.data?.rubrics.find((item) => item.id === milestone.rubricSnapshotId);
      const routeState: MilestoneDetailRouteState = {
        projectName: optionsQuery.data?.project?.name,
        rubricName: rubric?.name,
        rubricVersion: rubric?.version,
        returnTo: listUrl,
      };
      toast.success("Milestone created successfully.");
      navigate(teamScoped ? listUrl : `/projects/${projectId}/milestones/${milestone.id}`, { replace: true, state: routeState });
    },
    onError: async (error: unknown) => {
      const uncertain = isNetworkOrTimeoutError(error);
      const normalized = getMilestoneApiError(error);
      setNetworkUncertain(uncertain);
      setApiError(normalized);

      if (!uncertain && normalized.status === 409) attemptRef.current = null;
      if (normalized.status === 422 && normalized.errors && Object.keys(normalized.errors).some((key) => key.startsWith("rubric"))) {
        await optionsQuery.refetch();
      }

      toast.error(uncertain ? "The connection was interrupted. You can retry safely." : normalized.message || "Could not create milestone.");
    },
  });

  const plannedMutation = useMutation({
    mutationFn: (values: MilestoneFormValues) => {
      const parseDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
      const payload = {
        teamId: scopedTeamId,
        title: values.title.trim(), description: values.description.trim(),
        deadline: parseDate(values.deadline), mandatory: values.mandatory,
        startDate: values.startDate,
        rubricSnapshotId: values.rubricSnapshotId || null,
        checklist: values.checklist.filter(item => item.content.trim()).map((item, orderIndex) => ({ ...item, content: item.content.trim(), orderIndex })),
        latePolicyType: values.latePolicy.type,
        lateUntil: parseDate(values.latePolicy.lateUntil), latePenaltyPercent: values.latePolicy.penaltyPercent ?? null,
        allowResubmission: values.resubmissionPolicy.allowed, maxSubmissionAttempts: values.resubmissionPolicy.maxAttempts ?? null,
        expectedVersion: existingQuery.data?.version,
      };
      return milestoneApi.editPlanned(teamScoped ? undefined : projectId, scopedTeamId!, milestoneId!, payload);
    },
    onSuccess: (milestone) => {
      toast.success("Milestone changes saved.");
      navigate(teamScoped ? listUrl : `/projects/${projectId}/milestones/${milestone.id}`);
    },
    onError: (error) => setApiError(getMilestoneApiError(error)),
  });

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || completedRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const handleDirtyChange = useCallback((dirty: boolean) => setDirty(dirty), []);

  const handleSubmit = (values: MilestoneFormValues) => {
    const payload = { ...buildMilestonePayload(values), teamId: scopedTeamId };
    const serializedPayload = stablePayload(payload);
    const existing = attemptRef.current;
    const attempt = existing?.serializedPayload === serializedPayload
      ? existing
      : { key: crypto.randomUUID(), serializedPayload, payload };

    attemptRef.current = attempt;
    setApiError(null);
    setNetworkUncertain(false);
    createMutation.mutate(attempt);
  };

  const requestCancel = () => {
    if (isDirty) setCancelOpen(true);
    else navigate(listUrl);
  };
  const discardChangesDialog = <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
    <DialogContent showCloseButton={!createMutation.isPending}>
      <DialogHeader>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogDescription>Your unsaved milestone information will be lost.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setCancelOpen(false)}>Continue editing</Button>
        <Button variant="destructive" onClick={() => navigate(listUrl)}>Discard changes</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;

  if (!projectId && !teamScoped) {
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create" }}>
        <Alert variant="destructive"><AlertCircle /><AlertTitle>Missing project ID</AlertTitle><AlertDescription>The project for this milestone could not be determined.</AlertDescription></Alert>
      </MainLayout>
    );
  }

  if (milestoneId && existingQuery.data && (existingQuery.data.lifecycleStatus === "IN_PROGRESS" || existingQuery.data.lifecycleStatus === "CHANGES_REQUESTED")) {
    const detailUrl = teamScoped || !projectId
      ? `/teams/${scopedTeamId}/milestones/${milestoneId}${scopedWorkspaceId ? `?workspaceId=${scopedWorkspaceId}` : ""}`
      : `/projects/${projectId}/milestones/${milestoneId}${scopedTeamId ? `?teamId=${scopedTeamId}` : ""}`;
    return <MainLayout pathName={{ milestones: "Milestones", [milestoneId]: existingQuery.data.title, edit: "Edit" }}>
      <MilestoneActiveEditForm
        key={existingQuery.data.version}
        milestone={existingQuery.data}
        projectId={teamScoped ? undefined : projectId}
        teamId={scopedTeamId ?? existingQuery.data.teamId ?? 0}
        onCancel={requestCancel}
        onDirtyChange={handleDirtyChange}
        onSaved={() => {
          completedRef.current = true;
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["milestone"] }),
            queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] }),
            queryClient.invalidateQueries({ queryKey: ["team-milestone", scopedTeamId] }),
            queryClient.invalidateQueries({ queryKey: ["workspace-milestones"] }),
            queryClient.invalidateQueries({ queryKey: ["milestone-edit", projectId, scopedTeamId, milestoneId] }),
          ]);
          navigate(detailUrl, { replace: true });
        }}
      />
      {discardChangesDialog}
    </MainLayout>;
  }

  if (milestoneId && existingQuery.data && existingQuery.data.lifecycleStatus !== "PLANNED") {
    const detailUrl = teamScoped || !projectId
      ? `/teams/${scopedTeamId}/milestones/${milestoneId}${scopedWorkspaceId ? `?workspaceId=${scopedWorkspaceId}` : ""}`
      : `/projects/${projectId}/milestones/${milestoneId}${scopedTeamId ? `?teamId=${scopedTeamId}` : ""}`;
    return <Navigate to={detailUrl} replace />;
  }

  if (optionsQuery.isLoading || (milestoneId && existingQuery.isLoading)) {
    return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create" }}><CreatePageSkeleton /></MainLayout>;
  }

  if (optionsQuery.isError || !optionsQuery.data || (milestoneId && (existingQuery.isError || !existingQuery.data))) {
    const error = getMilestoneApiError(existingQuery.error ?? optionsQuery.error);
    const description = error.status === 403
      ? "You no longer have permission or an active assignment for this project."
      : error.status === 409
        ? "The project state has changed and no longer allows milestone creation."
        : error.message || "Could not load milestone creation data.";
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create" }}>
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader><CardTitle>Could not open the milestone form</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(listUrl)}><ArrowLeft className="size-4" /> Back to milestones</Button>
            {error.status !== 403 ? <Button onClick={() => optionsQuery.refetch()}><RefreshCw className="size-4" /> Reload</Button> : null}
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create", [projectId ?? `team-${scopedTeamId}`]: optionsQuery.data.project?.name ?? "Team workspace" }}>
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{optionsQuery.data.project?.status ?? "TEAM_ONLY"}</Badge>
              <span className="text-sm text-muted-foreground">{teamScoped ? "Team workspace context" : "Fixed project context"}</span>
            </div>
            <div>
              <CardTitle className="text-2xl">{milestoneId ? "Edit planned milestone" : "Create a milestone"} for {optionsQuery.data.project?.name ?? "this team workspace"}</CardTitle>
              <CardDescription className="mt-2">Define the delivery deadline, acceptance conditions, and evaluation rubric. Reviewers are assigned when submissions are evaluated.</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <MilestoneForm
          options={optionsQuery.data}
          defaultValues={defaultValues}
          submitting={createMutation.isPending || plannedMutation.isPending}
          apiError={apiError}
          networkUncertain={networkUncertain}
          onSubmit={milestoneId ? (values) => plannedMutation.mutate(values) : handleSubmit}
          submitLabel={milestoneId ? "Save changes" : undefined}
          onCancel={requestCancel}
          onDirtyChange={handleDirtyChange}
        />
      </div>

      {discardChangesDialog}
    </MainLayout>
  );
}
