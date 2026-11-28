import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneDetailError } from "../components/MilestoneDetailError";
import { MilestoneDetailView } from "../components/MilestoneDetailView";
import { getMilestoneApiError } from "../milestone.utils";

/** "/teams" and "/teams/:id/milestones" have no page; keep them out of the breadcrumb to avoid 404 links. */
const TEAM_ROUTE_GAPS = ["teams", "milestones"];

export function TeamMilestoneDetailPage() {
  const { teamId: teamIdParam, milestoneId } = useParams<{ teamId: string; milestoneId: string }>();
  const teamId = Number(teamIdParam);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceIdParam = Number(params.get("workspaceId"));
  const workspaceId = Number.isSafeInteger(workspaceIdParam) && workspaceIdParam > 0 ? workspaceIdParam : undefined;
  const query = useQuery({
    queryKey: ["team-milestone", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamDetail(teamId, milestoneId!),
    enabled: teamId > 0 && !!milestoneId,
    retry: false,
  });
  const routeReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const reportReturn = typeof routeReturn === "string" && (routeReturn === "/management/reports/projects" || routeReturn.startsWith("/management/reports/projects?")) ? routeReturn : null;
  const workspaceReturn = typeof routeReturn === "string" && workspaceId
    && routeReturn.startsWith(`/management/workspaces/${workspaceId}?`)
    && new URLSearchParams(routeReturn.split("?")[1]).get("tab") === "milestones"
    ? routeReturn : null;
  const back = () => navigate(reportReturn ?? workspaceReturn ?? (workspaceId ? `/management/workspaces/${workspaceId}?tab=milestones` : "/milestones/teams"));

  if (query.isPending) return <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={{ milestones: "Milestone" }}><div className="mx-auto grid max-w-6xl gap-5"><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></MainLayout>;
  if (query.isError || !query.data) return <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={{ milestones: "Milestone" }}>
    <MilestoneDetailError error={getMilestoneApiError(query.error)} onBack={back} onRetry={() => void query.refetch()} />
  </MainLayout>;

  const milestone = query.data;
  return <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={{ milestones: "Milestones", [milestone.id]: milestone.title }}>
    <MilestoneDetailView milestone={milestone} teamId={teamId} workspaceId={workspaceId} backLabel={reportReturn ? "Quay lại Project Dashboard" : workspaceId ? "Back to workspace" : "Choose team"} onBack={back} onRefresh={() => { void query.refetch(); }} />
  </MainLayout>;
}
