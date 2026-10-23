import { projectHubApi } from "@/api/features/project-hub.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { TeamCharter } from "@/types/features/project-hub";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getWorkspaceError } from "./workspace.shared";

export function TeamCharterForm({ teamId, initial }: { teamId: number; initial: TeamCharter }) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamCharter>({ mission: initial.mission ?? "", definitionOfDone: initial.definitionOfDone ?? "", primaryChannel: initial.primaryChannel ?? "", coreHours: initial.coreHours ?? "", conflictResolution: initial.conflictResolution ?? "" });
  const canEdit = hasPermission("TEAM_UPDATE");
  const channels = ["Microsoft Teams", "Slack", "Discord", "Google Chat", "Email"];
  const channel = form.primaryChannel === "Teams" ? "Microsoft Teams" : form.primaryChannel;
  const save = useMutation({
    mutationFn: () => projectHubApi.saveCharter(teamId, form),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["workspace-detail"] }), queryClient.invalidateQueries({ queryKey: ["project-teams"] })]);
      toast.success("Team charter saved");
    },
  });
  function submit(event: FormEvent) { event.preventDefault(); if (!save.isPending) save.mutate(); }
  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={!canEdit || save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="team-mission">Team mission</Label><Textarea id="team-mission" maxLength={2000} rows={4} value={form.mission} placeholder="The team's shared goals and intended value..." onChange={event => setForm({ ...form, mission: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="team-done">Definition of done</Label><Textarea id="team-done" maxLength={2000} rows={4} value={form.definitionOfDone} placeholder="Conditions a task must meet to be considered complete..." onChange={event => setForm({ ...form, definitionOfDone: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="team-channel">Primary channel</Label><Select value={channel || "__none__"} onValueChange={value => setForm({ ...form, primaryChannel: value === "__none__" ? "" : value })} disabled={!canEdit || save.isPending}><SelectTrigger id="team-channel" className="w-full"><SelectValue placeholder="Select a channel" /></SelectTrigger><SelectContent><SelectItem value="__none__">Not selected</SelectItem>{channel && !channels.includes(channel) && <SelectItem value={channel}>{channel}</SelectItem>}{channels.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="team-hours">Core hours</Label><Input id="team-hours" maxLength={255} value={form.coreHours} placeholder="For example: Monday–Friday, 19:00–21:00" onChange={event => setForm({ ...form, coreHours: event.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="team-conflict">Conflict resolution</Label><Textarea id="team-conflict" maxLength={2000} rows={3} value={form.conflictResolution} placeholder="How the team discusses issues, reaches agreement and involves the mentor..." onChange={event => setForm({ ...form, conflictResolution: event.target.value })} /></div>
      </fieldset>
      {save.isError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{getWorkspaceError(save.error)}</AlertDescription></Alert>}
      {canEdit && <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save charter</Button></div>}
    </form>
  );
}
