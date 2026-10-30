import { milestoneApi } from "@/api/features/milestone.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function MilestoneDraftHistory({ projectId, teamId, milestoneId }: {
  projectId?: string;
  teamId: number;
  milestoneId: string;
}) {
  const query = useQuery({
    queryKey: ["milestone-revisions", projectId, teamId, milestoneId],
    queryFn: () => milestoneApi.getDraftRevisions(projectId, teamId, milestoneId),
  });
  if (!query.data?.length) return null;
  return <Card>
    <CardHeader><CardTitle>Milestone revision history</CardTitle></CardHeader>
    <CardContent className="grid gap-2 text-sm">
      {query.data.map((revision) => {
        let snapshot: { title?: string; description?: string; deadline?: string; checklist?: { content: string }[] } = {};
        try { snapshot = JSON.parse(revision.snapshotJson); } catch { /* Older snapshots can still be listed. */ }
        return <details key={revision.id} className="rounded-md border p-3">
          <summary className="flex cursor-pointer flex-wrap justify-between gap-2">
            <span><strong>Revision {revision.revisionNumber}</strong> · {snapshot.title || "Saved milestone"}</span>
            <time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString()}</time>
          </summary>
          <div className="mt-3 grid gap-2 border-t pt-3 text-muted-foreground">
            {snapshot.description && <p>{snapshot.description}</p>}
            {snapshot.deadline && <p>Deadline: {new Date(snapshot.deadline).toLocaleString()}</p>}
            {snapshot.checklist?.length ? <ul className="list-inside list-disc">{snapshot.checklist.map((item, index) => <li key={index}>{item.content}</li>)}</ul> : null}
          </div>
        </details>;
      })}
    </CardContent>
  </Card>;
}
