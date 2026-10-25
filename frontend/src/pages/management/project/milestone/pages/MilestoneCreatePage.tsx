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
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MilestoneForm } from "../components/MilestoneForm";
import { milestoneDefaultValues, type MilestoneFormValues } from "../milestone-form.schema";
import {
  buildMilestonePayload,
  getMilestoneApiError,
  isNetworkOrTimeoutError,
  stablePayload,
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
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const listUrl = projectId ? `/projects/${projectId}/milestones` : "/teacher";
  const queryClient = useQueryClient();
  const [isDirty, setDirty] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [apiError, setApiError] = useState<MilestoneApiError | null>(null);
  const [networkUncertain, setNetworkUncertain] = useState(false);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const completedRef = useRef(false);

  const optionsQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", "create-options"],
    queryFn: () => milestoneApi.getCreateOptions(projectId as string),
    enabled: !!projectId,
    retry: false,
  });

  const defaultValues = useMemo<MilestoneFormValues>(() => ({
    ...milestoneDefaultValues,
    checklist: milestoneDefaultValues.checklist.map((item) => ({ ...item })),
    latePolicy: { ...milestoneDefaultValues.latePolicy },
    rubricSnapshotId: optionsQuery.data?.rubrics.length === 1 ? optionsQuery.data.rubrics[0].id : "",
  }), [optionsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (attempt: SubmissionAttempt) =>
      milestoneApi.create(projectId as string, attempt.payload, attempt.key),
    onSuccess: async (milestone) => {
      completedRef.current = true;
      attemptRef.current = null;
      setApiError(null);
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] });
      const rubric = optionsQuery.data?.rubrics.find((item) => item.id === milestone.rubricSnapshotId);
      const routeState: MilestoneDetailRouteState = {
        projectName: optionsQuery.data?.project.name,
        rubricName: rubric?.name,
        rubricVersion: rubric?.version,
        returnTo: listUrl,
      };
      toast.success("Milestone created successfully.");
      navigate(`/projects/${projectId}/milestones/${milestone.id}`, { replace: true, state: routeState });
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
    const payload = buildMilestonePayload(values);
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

  if (!projectId) {
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create" }}>
        <Alert variant="destructive"><AlertCircle /><AlertTitle>Missing project ID</AlertTitle><AlertDescription>The project for this milestone could not be determined.</AlertDescription></Alert>
      </MainLayout>
    );
  }

  if (optionsQuery.isLoading) {
    return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create" }}><CreatePageSkeleton /></MainLayout>;
  }

  if (optionsQuery.isError || !optionsQuery.data) {
    const error = getMilestoneApiError(optionsQuery.error);
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
    <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", new: "Create", [projectId]: optionsQuery.data.project.name }}>
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{optionsQuery.data.project.status}</Badge>
              <span className="text-sm text-muted-foreground">Fixed project context</span>
            </div>
            <div>
              <CardTitle className="text-2xl">Create a milestone for {optionsQuery.data.project.name}</CardTitle>
              <CardDescription className="mt-2">Define the delivery deadline, acceptance conditions, and evaluation rubric. Reviewers are assigned when submissions are evaluated.</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <MilestoneForm
          options={optionsQuery.data}
          defaultValues={defaultValues}
          submitting={createMutation.isPending}
          apiError={apiError}
          networkUncertain={networkUncertain}
          onSubmit={handleSubmit}
          onCancel={requestCancel}
          onDirtyChange={handleDirtyChange}
        />
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
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
      </Dialog>
    </MainLayout>
  );
}
