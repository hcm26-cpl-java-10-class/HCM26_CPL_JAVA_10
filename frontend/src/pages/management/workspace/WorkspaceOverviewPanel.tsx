import type { WorkspaceDetail } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function information(value?: string | null) {
  return value?.trim() || "No information available";
}

function attachmentUrl(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function WorkspaceOverviewPanel({ workspace, canViewMembers, onViewMembers }: {
  workspace: WorkspaceDetail;
  canViewMembers: boolean;
  onViewMembers: () => void;
}) {
  const topic = workspace.topic_snapshot;
  const requirements = topic?.requirements ?? [];
  const attachments = topic?.attachments ?? [];

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Project brief</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {topic && <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-muted-foreground">Brief code</p><p>{information(topic.topic_code)}</p></div>
            <div><p className="text-muted-foreground">Version</p><p>{information(topic.version)}</p></div>
            <div className="sm:col-span-2"><p className="text-muted-foreground">Brief title</p><p>{information(topic.topic_title)}</p></div>
          </div>}
          <div><p className="mb-2 text-sm font-medium">Description</p><p className="whitespace-pre-wrap text-sm leading-7">{information(topic?.description ?? workspace.projectDescription)}</p></div>
          <div><p className="mb-2 text-sm font-medium">Objectives</p><p className="whitespace-pre-wrap text-sm leading-7">{information(topic?.objectives)}</p></div>
          <div><p className="mb-2 text-sm font-medium">Requirements</p>
            {requirements.length ? <ul className="list-disc space-y-2 pl-5 text-sm">{requirements.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="text-sm text-muted-foreground">No information available</p>}
          </div>
          <div><p className="mb-2 text-sm font-medium">Attachments</p>
            {attachments.length ? <ul className="space-y-2 text-sm">{attachments.map((item, index) => {
              const href = attachmentUrl(item.url);
              return <li key={index}>{href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{information(item.name)}</a>
                : <span>{information(item.name)}</span>}</li>;
            })}</ul> : <p className="text-sm text-muted-foreground">No information available</p>}
          </div>
        </CardContent>
      </Card>
    </div>
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>{workspace.teamName}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm"><span className="font-medium">{workspace.member_count}</span> active members</p>
          {canViewMembers ? <Button variant="outline" className="w-full" onClick={onViewMembers}>View members</Button>
            : <p className="text-sm text-muted-foreground">You do not have permission to view member details.</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Mentor</CardTitle></CardHeader>
        <CardContent className="text-sm">{workspace.mentorName?.trim() || "No mentor assigned"}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Workspace information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Code: {workspace.code}</p>
          <p>Created by: {workspace.createdByName || "Not available"}</p>
          <p>Created at: {workspace.createdAt ? new Date(workspace.createdAt).toLocaleString("en-GB") : "Not available"}</p>
        </CardContent>
      </Card>
    </div>
  </div>;
}
