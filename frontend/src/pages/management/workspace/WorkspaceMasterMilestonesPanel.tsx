import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CalendarClock, ClipboardCheck, Upload } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectCompletionPanel } from "./ProjectCompletionPanel";

export function WorkspaceMasterMilestonesPanel({ masterProjectId, returnTo, onChanged }: {
  masterProjectId: number; returnTo: string; onChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const requestKey = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["workspace-master-milestones", masterProjectId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.classMasterMilestones(masterProjectId, signal),
    retry: false, refetchInterval: 20_000,
  });
  const submit = useMutation({
    mutationFn: (milestoneId: string) => {
      requestKey.current ??= crypto.randomUUID();
      const payload = { evidenceUrl: url.trim(), notes: notes.trim() };
      return projectAssignmentApi.submitClassMaster(masterProjectId, milestoneId, payload, requestKey.current);
    },
    onSuccess: result => {
      setSelected(null); requestKey.current = null;
      void client.invalidateQueries({ queryKey: ["workspace-master-milestones"] });
      onChanged();
      navigate(`/milestone-submissions/${result.id}`, { state: { returnTo } });
    },
  });
  if (query.isError) return <Card><CardContent className="space-y-3 pt-5"><p role="alert">Unable to load shared master milestones.</p>
    <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></CardContent></Card>;
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading master milestones…</p>;
  const data = query.data;
  if (!data) return null;
  let validUrl = false;
  try { const parsed = new URL(url.trim()); validUrl = ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; } catch { /* Wait for a complete URL. */ }
  const refresh = () => { void query.refetch(); onChanged(); };
  return <>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
      <CardTitle>Master milestones</CardTitle>
      <Badge variant="outline">Managed by class mentors</Badge>
    </div><CardDescription>{data.projectName}. Class mentors record submissions and assess the Master milestones here.</CardDescription>
    </CardHeader><CardContent className="space-y-3">
      {data.milestones.length === 0 && <p className="text-sm text-muted-foreground">No master milestones configured.</p>}
      {data.milestones.map(milestone => <div key={milestone.id} className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
          <p className="text-sm font-semibold">{milestone.title}</p>
          {milestone.description && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{milestone.description}</p>}
        </div><div className="flex flex-wrap gap-2"><Badge variant="secondary">Master</Badge>
          {milestone.mandatory && <Badge variant="outline">Required</Badge>}
          <Badge variant="outline">{milestone.waived ? "Waived" : milestone.status.replaceAll("_", " ")}</Badge></div></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" />
            {milestone.deadline ? new Date(milestone.deadline).toLocaleString("en-GB") : "No deadline"}</p>
          <div className="flex flex-wrap gap-2">
            {milestone.canSubmit && <Button size="sm" variant="outline" onClick={() => {
              submit.reset(); requestKey.current = null; setUrl(""); setNotes(""); setSelected(milestone);
            }}><Upload className="size-4" />Record shared submission</Button>}
            {milestone.submissionId && <Button size="sm" variant="outline" onClick={() => navigate(`/milestone-submissions/${milestone.submissionId}`,
              { state: { returnTo } })}><ClipboardCheck className="size-4" />Review / history</Button>}
          </div>
        </div>
      </div>)}
    </CardContent></Card>
    {data.canManage && <ProjectCompletionPanel key={`${data.projectId}:${data.teamId}`}
      projectId={data.projectId} teamId={data.teamId} title={`Master completion — ${data.projectName}`}
      readOnly={data.readOnly} onChanged={refresh} />}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !submit.isPending) setSelected(null); }}><DialogContent>
      <DialogHeader><DialogTitle>Record shared master submission</DialogTitle><DialogDescription>
        {selected?.title}. Record the common deliverable on behalf of the class, then review it using the milestone rubric.
      </DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="master-evidence-url">Evidence link</Label>
        <Input id="master-evidence-url" type="url" maxLength={1000} placeholder="https://…" value={url} disabled={submit.isPending}
          onChange={event => { setUrl(event.target.value); requestKey.current = null; }} /></div>
      <div className="space-y-2"><Label htmlFor="master-evidence-notes">Submission notes</Label>
        <Textarea id="master-evidence-notes" maxLength={2000} value={notes} disabled={submit.isPending}
          onChange={event => { setNotes(event.target.value); requestKey.current = null; }} /></div>
      {submit.isError && <p role="alert" className="text-sm text-destructive">{axios.isAxiosError<{ message?: string }>(submit.error)
        ? submit.error.response?.data?.message ?? "Unable to record this submission." : "Unable to record this submission."}</p>}
      <DialogFooter><Button variant="outline" disabled={submit.isPending} onClick={() => setSelected(null)}>Cancel</Button>
        <Button disabled={!validUrl || submit.isPending || data.readOnly} onClick={() => selected && submit.mutate(selected.id)}>
          {submit.isPending ? "Submitting…" : "Submit for review"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
