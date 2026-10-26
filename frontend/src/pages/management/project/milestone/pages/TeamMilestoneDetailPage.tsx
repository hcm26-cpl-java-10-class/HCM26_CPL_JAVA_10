import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamMilestoneDetailPage() {
  const { teamId: teamIdParam, milestoneId } = useParams<{ teamId: string; milestoneId: string }>();
  const teamId = Number(teamIdParam);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = params.get("workspaceId");
  const query = useQuery({
    queryKey: ["team-milestone", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamDetail(teamId, milestoneId!),
    enabled: teamId > 0 && !!milestoneId,
    retry: false,
  });
  const back = () => navigate(workspaceId ? `/management/workspaces/${workspaceId}?tab=milestones` : `/teams/${teamId}/milestones`);
  if (query.isPending) return <MainLayout pathName={{ milestones: "Milestone" }}><p>Loading milestone...</p></MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ milestones: "Milestone" }}><Card><CardContent className="space-y-4 p-6"><p>Could not load milestone.</p><Button onClick={back}><ArrowLeft />Back</Button></CardContent></Card></MainLayout>;
  const milestone = query.data;
  return <MainLayout pathName={{ milestones: "Milestones", [milestone.id]: milestone.title }}>
    <div className="mx-auto grid max-w-5xl gap-6">
      <Card><CardHeader><div className="flex gap-2"><Badge>{milestone.status}</Badge>{milestone.mandatory && <Badge variant="secondary">Mandatory</Badge>}</div><CardTitle>{milestone.title}</CardTitle></CardHeader><CardContent className="space-y-3">
        {milestone.description && <p className="whitespace-pre-wrap">{milestone.description}</p>}
        <p className="flex items-center gap-2 text-sm"><CalendarClock className="size-4" />{new Date(milestone.deadline).toLocaleString("en-GB")}</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Acceptance checklist</CardTitle></CardHeader><CardContent className="space-y-2">{milestone.checklist.map(item => <div key={item.id} className="rounded border p-3">{item.content}</div>)}</CardContent></Card>
      <Button variant="outline" onClick={back}><ArrowLeft />Back to workspace</Button>
    </div>
  </MainLayout>;
}
