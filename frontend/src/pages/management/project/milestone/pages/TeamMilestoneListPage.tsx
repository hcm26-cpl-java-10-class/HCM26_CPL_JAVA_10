import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";

export function TeamMilestoneListPage() {
  const teamId = Number(useParams<{ teamId: string }>().teamId);
  const query = useQuery({
    queryKey: ["team-milestones", teamId],
    queryFn: () => milestoneApi.getTeamList(teamId, { page: 0, size: 100 }),
    enabled: Number.isSafeInteger(teamId) && teamId > 0,
    retry: false,
  });
  return <MainLayout pathName={{ teams: "Teams", milestones: "Milestones" }}>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4"><CardTitle>Team milestones</CardTitle>
        <Button asChild variant="outline"><Link to="/milestones/teams">Change team</Link></Button></CardHeader>
      <CardContent>
        {query.isPending && <p className="py-8 text-sm text-muted-foreground">Loading milestones...</p>}
        {query.isError && <p className="rounded-md border p-6 text-sm text-destructive">Could not load team milestones.</p>}
        {query.data?.content.length === 0 && <p className="py-8 text-sm text-muted-foreground">No milestones yet.</p>}
        <div className="divide-y">
          {query.data?.content.map(milestone => <div key={milestone.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">{milestone.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{milestone.description || "No description available."}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3" />{new Date(milestone.deadline).toLocaleString("en-GB")}
              </p>
            </div>
            <Badge variant="outline">{milestone.status}</Badge>
          </div>)}
        </div>
      </CardContent>
    </Card>
  </MainLayout>;
}
