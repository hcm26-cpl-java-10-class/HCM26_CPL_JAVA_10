import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import type { MilestoneDetailRouteState } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MilestoneDetailError } from "../components/MilestoneDetailError";
import { MilestoneDetailView } from "../components/MilestoneDetailView";
import { getMilestoneApiError } from "../milestone.utils";

export function MilestoneDetailPage() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const teamIdParam = Number(searchParams.get("teamId"));
  const teamId = Number.isSafeInteger(teamIdParam) && teamIdParam > 0 ? teamIdParam : undefined;
  const routeState = location.state as MilestoneDetailRouteState | null;
  const defaultListUrl = projectId ? `/projects/${projectId}/milestones` : "/teacher";
  const workspaceReturn = routeState?.returnTo && /^\/management\/workspaces\/\d+\?/.test(routeState.returnTo)
    && new URLSearchParams(routeState.returnTo.split("?")[1]).get("tab") === "milestones"
    ? routeState.returnTo : null;
  const returnUrl = workspaceReturn ?? (routeState?.returnTo?.startsWith(`/projects/${projectId}/milestones`)
    ? routeState.returnTo : defaultListUrl);

  const detailQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", milestoneId, teamId],
    queryFn: () => milestoneApi.getDetail(projectId as string, milestoneId as string, teamId),
    enabled: Boolean(projectId && milestoneId),
    retry: false,
  });

  if (detailQuery.isLoading) return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}><div className="mx-auto grid max-w-6xl gap-5"><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></MainLayout>;

  if (detailQuery.isError || !detailQuery.data) return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}>
    <MilestoneDetailError error={getMilestoneApiError(detailQuery.error)} onBack={() => navigate(returnUrl)} onRetry={() => void detailQuery.refetch()} />
  </MainLayout>;

  const milestone = detailQuery.data;
  return <MainLayout pathName={{ projects: "Projects", [milestone.project?.id ?? projectId ?? "project"]: milestone.project?.name ?? "Project", milestones: "Milestones", [milestone.id]: milestone.title }}>
    <MilestoneDetailView milestone={milestone} projectId={projectId} teamId={milestone.teamId ?? teamId} backLabel={workspaceReturn ? "Back to workspace" : "Back to milestones"} onBack={() => navigate(returnUrl)} onRefresh={() => { void detailQuery.refetch(); }} />
  </MainLayout>;
}
