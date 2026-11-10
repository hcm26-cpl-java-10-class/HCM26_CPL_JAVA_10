import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memberReminderApi } from "@/api/features/member-reminder.api";
import type { InactiveMember } from "@/types/features/member-reminder";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MemberReminderDialog } from "./MemberReminderDialog";
import { getTaskError } from "../task-form.utils";

const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
function ReminderHistory({ projectId, userId }: { projectId: string; userId: number }) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({ queryKey: ["member-reminder-history", user.email, activeRole, projectId, userId],
    queryFn: ({ signal }) => memberReminderApi.history(projectId, userId, signal), retry: false, gcTime: 0 });
  return query.isPending ? <p role="status">Loading reminders...</p>
    : query.isError ? <div><p role="alert">{getTaskError(query.error).message}</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
    : !query.data.length ? <p>No reminders yet.</p>
    : <div className="divide-y">{query.data.map(item => <div key={item.batchId} className="space-y-2 py-3">
      <div className="flex justify-between gap-3"><span>{date(item.createdAt)}</span><Badge variant="outline">{item.status==="PENDING"?"Queued":"Published"}</Badge></div>
      <p className="whitespace-pre-wrap break-words">{item.warningNote}</p></div>)}</div>;
}
export function InactiveMemberPanel({ projectId }: { projectId: string }) {
  const { user, activeRole, hasPermission } = usePermissions(), client = useQueryClient();
  const [inactiveOnly,setInactiveOnly] = useState(true), [selected,setSelected] = useState<Map<number,InactiveMember>>(new Map());
  const [note,setNote] = useState(""), [open,setOpen] = useState(false), [busy,setBusy] = useState(false);
  const [historyId,setHistoryId] = useState<number>();
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const query = useQuery({ queryKey: ["inactive-members",user.email,activeRole,projectId,inactiveOnly],
    queryFn: ({ signal }) => memberReminderApi.list(projectId,inactiveOnly,signal), retry:false,gcTime:0 });
  const error = query.isError ? getTaskError(query.error) : undefined;
  const denied = error?.status===401 || error?.status===403;
  const data = query.isError ? undefined : query.data;
  const canSend = !!data?.canSend && hasPermission("INACTIVE_MEMBER_SEND");
  async function reload() {
    const result = await query.refetch();
    if (result.isSuccess) setSelected(previous => new Map([...previous].map(([id,old]) =>
      [id,result.data.content.find(member => member.userId===id) ?? old])));
    // Intentionally retain recipients missing from a refreshed list until the user removes them.
  }
  return <>
    <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><CardTitle>Inactive members</CardTitle>
      <div className="flex flex-wrap gap-2">
        <Button variant={inactiveOnly?"default":"outline"} disabled={busy} onClick={() => setInactiveOnly(true)}>Inactive only</Button>
        <Button variant={inactiveOnly?"outline":"default"} disabled={busy} onClick={() => setInactiveOnly(false)}>All members</Button>
        <Button variant="outline" disabled={busy||query.isFetching} onClick={() => void reload()}>Refresh</Button>
        {canSend && <Button disabled={busy||query.isFetching||!selected.size} onClick={() => setOpen(true)}>Send reminders</Button>}
      </div></div>
      <p className="text-sm text-muted-foreground">A member is inactive after {data?.inactivityHours ?? 168} hours without a contribution.
        New members receive the same grace period. Reminder cooldown: {(data?.cooldownSeconds ?? 86400)/3600} hours.</p>
      <p className="text-xs text-muted-foreground">Uses Task activity and configured Artifact/Commit contributions. Login, page views and sending alerts do not count.</p>
    </CardHeader><CardContent>
      {!denied && selected.size>0 && <div className="mb-4 flex flex-wrap gap-2" aria-label="Selected members">
        {[...selected.values()].map(member => <Button key={member.userId} size="sm" variant="secondary" disabled={busy}
          aria-label={"Remove "+member.displayName} onClick={() => setSelected(previous => {const next=new Map(previous);next.delete(member.userId);return next;})}>
          {member.displayName} ×</Button>)}
      </div>}
      {query.isPending ? <p role="status">Loading member activity...</p>
        : query.isError ? <div className="space-y-3"><p role="alert">{error?.message}</p><Button variant="outline" onClick={() => void reload()}>Try again</Button></div>
        : !data?.content.length ? <p className="py-8 text-center text-muted-foreground">{inactiveOnly?"No inactive members.":"No current student members."}</p>
        : <Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Member</TableHead><TableHead>Joined</TableHead>
            <TableHead>Last contribution</TableHead><TableHead>Activity</TableHead><TableHead>Reminder</TableHead></TableRow></TableHeader>
          <TableBody>{data.content.map(member => <TableRow key={member.userId}>
            <TableCell><Checkbox aria-label={"Select "+member.displayName} checked={selected.has(member.userId)}
              disabled={!canSend||!member.inactive||busy||query.isFetching} onCheckedChange={checked => setSelected(previous => {
                const next=new Map(previous);if(checked===true)next.set(member.userId,member);else next.delete(member.userId);return next;})}/></TableCell>
            <TableCell><p className="font-medium">{member.displayName}</p><p className="text-xs text-muted-foreground">{member.userCode ?? "—"}</p></TableCell>
            <TableCell>{date(member.joinedAt)}</TableCell><TableCell>{member.lastContributionAt?date(member.lastContributionAt):"No contribution since joining"}</TableCell>
            <TableCell><Badge variant={member.inactive?"destructive":"outline"}>{member.activityStatus==="NEW_MEMBER"?"New member":member.activityStatus==="JOIN_DATE_UNKNOWN"?"Joined date unavailable":member.inactive?"Inactive":"Active"}</Badge></TableCell>
            <TableCell><div className="space-y-2">{member.coolingDown && <p className="text-xs text-muted-foreground">Cooldown until {date(member.nextReminderAt)}</p>}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setHistoryId(member.userId)}>Reminder history</Button></div></TableCell>
          </TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    {open&&!denied && <MemberReminderDialog projectId={projectId} members={[...selected.values()]} note={note} onNoteChange={setNote}
      enabled={canSend&&!query.isFetching} request={request} onBusy={setBusy} onClose={() => setOpen(false)} onReload={reload}
      onSent={() => {setOpen(false);setSelected(new Map());setNote("");request.current=null;
        void client.invalidateQueries({queryKey:["inactive-members"]});void client.invalidateQueries({queryKey:["member-reminder-history"]});}}/>}
    {historyId!==undefined&&!denied && <Dialog open onOpenChange={value => {if(!value)setHistoryId(undefined);}}>
      <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Reminder history</DialogTitle></DialogHeader>
        <ReminderHistory projectId={projectId} userId={historyId}/></DialogContent></Dialog>}
  </>;
}
