import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { Bell, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { projectAlertApi } from "@/api/features/project-alert.api";
import { alertRowKey, alertRowName, type AlertFilters, type AlertKind, type AlertOptions, type AlertPage,
  type AlertRow, type InactiveAlert } from "@/types/features/project-alert";
import { AlertSendDialog } from "./AlertSendDialog";
import { MemberWorkResultsDialog } from "./MemberWorkResultsDialog";
import { getAlertError } from "./alert-errors";

const kinds: AlertKind[] = ["BACKLOG","MILESTONE","INACTIVE"];
const titles: Record<AlertKind,string> = { BACKLOG:"Backlog items & tasks", MILESTONE:"Milestones", INACTIVE:"Inactive members" };
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const numeric = (value: string | null) => value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
const closedProject = (status?: string | null) => status === "COMPLETED" || status === "CANCELLED";
const label = (value: string) => value === "TODO" ? "To do" : value.toLowerCase().replaceAll("_"," ").replace(/^./,c => c.toUpperCase());
function FilterSelect({ name, value, values, disabled, onChange }: {
  name: string; value?: number; values: { id:number; name:string }[]; disabled:boolean; onChange:(value:string)=>void;
}) {
  const plural = name === "Class" ? "classes" : name.toLowerCase() + "s";
  return <div className="min-w-0 space-y-2"><Label>{name}</Label><Select value={value ? String(value) : "all"} disabled={disabled} onValueChange={onChange}>
    <SelectTrigger aria-label={name} className="w-full min-w-0"><SelectValue placeholder={"All " + plural}/></SelectTrigger>
    <SelectContent><SelectItem value="all">All {plural}</SelectItem>{values.map(option =>
      <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
function TeamHistory({ teamId, kind, owner, onClose }: { teamId:number; kind:AlertKind; owner:string; onClose:()=>void }) {
  const query = useQuery({ queryKey:["project-alert-history",owner,teamId,kind],
    queryFn:({signal})=>projectAlertApi.history(teamId,kind,signal),retry:false,gcTime:0 });
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>Team alert history · {titles[kind]}</DialogTitle></DialogHeader>
    {query.isPending ? <p role="status">Loading alert history...</p> : query.isError ? <div className="space-y-3"><p role="alert">{getAlertError(query.error).message}</p>
      <Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button></div> : !query.data.length ? <p>No alerts have been queued for this team.</p>
      : <div className="divide-y">{query.data.map(item=><div key={item.batchId} className="space-y-2 py-3">
        <div className="flex flex-wrap justify-between gap-2"><span className="text-sm">{date(item.createdAt)}</span><Badge variant="outline">{item.status==="PENDING"?"Queued":label(item.status)}</Badge></div>
        <p className="whitespace-pre-wrap break-words text-sm">{item.warningNote}</p><p className="text-xs text-muted-foreground">{item.recipientCount} recipient(s)</p>
      </div>)}</div>}
  </DialogContent></Dialog>;
}
interface ResultsProps {
  kind:AlertKind; owner:string; data?:AlertPage; loading:boolean; fetching:boolean; error?:unknown; options:AlertOptions;
  page:number; busy:boolean; onBusy:(busy:boolean)=>void; onPage:(page:number)=>void;
  teamId?:number;
  inactiveOnly:boolean;
  reload:()=>Promise<AlertPage|undefined>; onChanged:()=>void;
}
function AlertResults({ kind,owner,data,loading,fetching,error,options,page,teamId,inactiveOnly,busy,onBusy,onPage,reload,onChanged }:ResultsProps) {
  const [selected,setSelected]=useState<Map<string,AlertRow>>(new Map()),[note,setNote]=useState(""),[open,setOpen]=useState(false);
  const [historyTeam,setHistoryTeam]=useState<number>();
  const [workMember,setWorkMember]=useState<InactiveAlert>();
  const request=useRef<{fingerprint:string;key:string}|null>(null),draftScope=useRef("");
  const failure=error?getAlertError(error):undefined,denied=[401,403].includes(failure?.status??0);
  const rows=error?[]:data?.content??[],selectedRows=[...selected.values()],selectedTeam=selectedRows[0]?.team.id;
  const selectedContext=options.teams.find(team=>team.id===(teamId??selectedTeam));
  const projectClosed=closedProject(selectedContext?.projectStatus);
  const canSend=!!options.permissions[kind+"_SEND"]&&!projectClosed;
  function showSend(values:AlertRow[]) {
    if(!values.length)return;
    const scope=`${kind}:${values[0].team.id}:${kind==="MILESTONE"?values[0].id:"batch"}`;
    if(draftScope.current!==scope){setNote("");draftScope.current=scope;}
    setSelected(new Map(values.map(row=>[alertRowKey(row),row])));setOpen(true);
  }
  async function refresh() {
    const fresh=await reload();
    if(fresh)setSelected(previous=>new Map([...previous].map(([key,old])=>[key,fresh.content.find(row=>alertRowKey(row)===key)??old])));
  }
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{kind==="INACTIVE"&&!inactiveOnly?"Team members":titles[kind]}</CardTitle>
    <div className="flex flex-wrap gap-2">{teamId!==undefined&&<Button variant="outline" disabled={busy} onClick={()=>setHistoryTeam(teamId)}>Team alert history</Button>}
      <Button variant="outline" disabled={busy||fetching} onClick={()=>void refresh()}><RefreshCw className={fetching?"size-4 animate-spin":"size-4"}/>Refresh</Button>
      {kind!=="MILESTONE"&&canSend&&<Button disabled={busy||fetching||!selected.size} onClick={()=>showSend(selectedRows)}>Send alert</Button>}</div></div>
    <p className="text-sm text-muted-foreground">{kind==="BACKLOG"?"Overdue top-level backlog items that are not Done. Alerts go to their current assignees. Subtasks are excluded."
      :kind==="MILESTONE"?"Milestones due within the next 48 hours with fewer than 80% of their backlog items Done. Progress is calculated automatically. Completed, cancelled and past-deadline milestones are excluded."
      :`Members with assigned Todo work who have not started any task for ${options.inactiveHours/24} days. New assignments and team joins receive the same grace period. Cooldown: ${options.cooldownSeconds/3600} hours.`}</p>
    {kind==="INACTIVE"&&<p className="text-xs text-muted-foreground">Starting any task resets the inactivity window, even if older Todo tasks remain. Editing descriptions or submitting artifacts does not reset it.</p>}
  </CardHeader><CardContent className="space-y-4">
    {projectClosed&&<p role="status" className="rounded border p-3 text-sm">This project is {label(selectedContext!.projectStatus!).toLowerCase()}. New alerts are disabled. You can still view team alert history.</p>}
    {!denied&&selected.size>0&&<div className="flex flex-wrap gap-2" aria-label="Selected items">{selectedRows.map(row=><Button size="sm" variant="secondary" key={alertRowKey(row)} disabled={busy}
      aria-label={"Remove "+alertRowName(row)} onClick={()=>setSelected(previous=>{const next=new Map(previous);next.delete(alertRowKey(row));return next;})}>{alertRowName(row)} ×</Button>)}</div>}
    {kind!=="MILESTONE"&&canSend&&<p className="text-xs text-muted-foreground">Select items from one team per alert.
      {kind==="BACKLOG"&&" Items need a team sprint or an active team assignee to appear here."}</p>}
    {loading?<p role="status">Loading {titles[kind].toLowerCase()}...</p>:failure?<div className="space-y-3"><p role="alert" className="text-destructive">{failure.message}</p>
      <Button variant="outline" onClick={()=>void refresh()}>Try again</Button></div>:!rows.length?<div className="py-10 text-center text-muted-foreground">
        {kind==="INACTIVE"?(inactiveOnly?"No inactive members match these filters.":"No current student members match these filters."):kind==="MILESTONE"?"No milestones are below 80% within the next 48 hours.":"No overdue backlog items match these filters."}</div>
      :<Table><TableHeader><TableRow>{kind!=="MILESTONE"&&<TableHead>Select</TableHead>}<TableHead>{kind==="INACTIVE"?"Member":"Item"}</TableHead>
        <TableHead>Class / Team</TableHead><TableHead>{kind==="INACTIVE"?"Last task started":"Deadline"}</TableHead>
        <TableHead>{kind==="MILESTONE"?"Work progress":kind==="INACTIVE"?"Activity status":"Status"}</TableHead>
        {kind==="INACTIVE"&&<TableHead>Work results</TableHead>}<TableHead>Actions</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row=>{
        const member="displayName"in row?row:undefined,milestone="progress"in row?row:undefined,backlog="workType"in row?row:undefined;
        const selectable=canSend&&(member?member.inactive:row.canSend);
        return <TableRow key={alertRowKey(row)}>
          {kind!=="MILESTONE"&&<TableCell><Checkbox aria-label={"Select "+alertRowName(row)} checked={selected.has(alertRowKey(row))}
            disabled={busy||fetching||!selectable||selectedTeam!==undefined&&selectedTeam!==row.team.id}
            onCheckedChange={checked=>setSelected(previous=>{const next=new Map(previous);if(checked===true)next.set(alertRowKey(row),row);else next.delete(alertRowKey(row));return next;})}/></TableCell>}
          <TableCell className="min-w-48 max-w-80 whitespace-normal"><p className="font-medium">{alertRowName(row)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{member?`${member.userCode??"No member code"} · ${member.projectRole??"Unassigned role"}`:backlog?`${label(backlog.workType)} · ${backlog.assigneeName??"Unassigned"}`:label(milestone!.status)}</p>
            {milestone&&<Badge variant="outline" className="mt-2">{milestone.mandatory?"Mandatory":"Optional"}</Badge>}</TableCell>
          <TableCell className="whitespace-normal"><p>{row.team.className}</p><p className="text-xs text-muted-foreground">{row.team.name}</p></TableCell>
          <TableCell>{member?<><p>{member.lastTaskStartedAt?date(member.lastTaskStartedAt):"No task started"}</p><p className="text-xs text-muted-foreground">Todo work assigned since: {date(member.pendingSince)}</p></>
            :<><p>{date((backlog??milestone!).deadline)}</p><Badge variant={(backlog??milestone!).deadlineStatus==="OVERDUE"?"destructive":"outline"}>{label((backlog??milestone!).deadlineStatus)}</Badge></>}</TableCell>
          <TableCell>{milestone?<div className="space-y-1"><p>{milestone.progress.percentage}% · {milestone.progress.done}/{milestone.progress.total} Done</p>
              <Badge variant="destructive">Below 80%</Badge></div>
            :member?<div className="space-y-1"><Badge variant={member.inactive?"destructive":"outline"}>{label(member.activityStatus)}</Badge>
              {member.coolingDown&&<p className="text-xs text-muted-foreground">Cooldown until {date(member.nextReminderAt)}</p>}</div>
            :<Badge variant="outline">{label(backlog!.status)}</Badge>}</TableCell>
          {member&&<TableCell className="min-w-48 whitespace-normal">{member.workResults?<div className="space-y-1">
            {member.workResults.assigned===0?<p className="text-sm text-muted-foreground">No assigned backlog items</p>:<>
              <p>{member.workResults.done}/{member.workResults.assigned} Done · {member.workResults.percentage}%</p>
              <p className="text-xs text-muted-foreground">{member.workResults.overdue} overdue · {member.workResults.inReview} in review</p>
            </>}
          </div>:<p className="text-xs text-muted-foreground">Work results require permission to view backlog items and member details.</p>}</TableCell>}
          <TableCell><div className="flex flex-wrap gap-2">
            {member&&member.workResults&&<Button size="sm" variant="outline" aria-label={"Work results for "+member.displayName}
              disabled={busy||fetching} onClick={()=>setWorkMember(member)}>Work results</Button>}
            {milestone&&canSend&&<Button size="sm" disabled={busy||fetching||!row.canSend} onClick={()=>showSend([row])}>{"Send risk alert"}</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={()=>setHistoryTeam(row.team.id)}>History</Button>
          </div></TableCell>
        </TableRow>;
      })}</TableBody></Table>}
    {data&&!error&&<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{data.total} result(s) · Updated {date(data.asOf)}</span>
      <div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={busy||fetching||page===0} onClick={()=>onPage(page-1)}>Previous</Button>
        <span>Page {page+1} of {Math.max(1,Math.ceil(data.total/data.size))}</span><Button variant="outline" size="sm" disabled={busy||fetching||(page+1)*data.size>=data.total} onClick={()=>onPage(page+1)}>Next</Button></div></div>}
    {open&&!denied&&<AlertSendDialog kind={kind} rows={selectedRows} owner={owner} note={note} setNote={setNote} request={request} onBusy={onBusy}
      onClose={()=>{setOpen(false);if(kind==="MILESTONE")setSelected(new Map());}} onReload={refresh}
      onSent={()=>{setOpen(false);setSelected(new Map());setNote("");request.current=null;onChanged();}}/>}
    {workMember&&!denied&&<MemberWorkResultsDialog key={`${workMember.team.id}:${workMember.id}`} row={workMember} owner={owner}
      onClose={()=>setWorkMember(undefined)} onAccessChanged={onChanged}/>}
    {historyTeam!==undefined&&!denied&&<TeamHistory teamId={historyTeam} kind={kind} owner={owner} onClose={()=>setHistoryTeam(undefined)}/>}
  </CardContent></Card>;
}
function AlertConsole() {
  const {user,activeRole,hasPermission}=usePermissions(),owner=`${user.email}:${activeRole}`,client=useQueryClient();
  const [search,setSearch]=useSearchParams(),[busy,setBusy]=useState(false);
  const options=useQuery({queryKey:["project-alert-options",owner],queryFn:({signal})=>projectAlertApi.options(signal),retry:false,gcTime:0,refetchInterval:60000});
  const kind=(kinds.includes(search.get("view") as AlertKind)?search.get("view"):"BACKLOG") as AlertKind;
  const filters:AlertFilters={programId:numeric(search.get("programId")),cohortId:numeric(search.get("cohortId")),
    classId:numeric(search.get("classId")),teamId:numeric(search.get("teamId")),teamSearch:search.get("teamSearch")??"",
    deadlineStatus:search.get("deadlineStatus")??"ALL",windowHours:numeric(search.get("windowHours"))??48,
    page:Number(search.get("page"))>=0?Number(search.get("page")):0,size:20,inactiveOnly:search.get("inactiveOnly")!=="false"};
  const queries=useQueries({queries:kinds.map(source=>({queryKey:["project-alerts",owner,source,filters],
    queryFn:({signal}:{signal:AbortSignal})=>projectAlertApi.list(source,{...filters, deadlineStatus:source==="MILESTONE"?"UPCOMING":source==="BACKLOG"?"OVERDUE":filters.deadlineStatus,windowHours:48},signal),
    enabled:!!options.data?.permissions[source+"_READ"],retry:false,gcTime:0,refetchInterval:60000}))});
  const query=queries[kinds.indexOf(kind)];
  const accessChanged=queries.some(result=>result.isError&&[401,403].includes(getAlertError(result.error).status??0));
  useEffect(()=>{if(accessChanged)void options.refetch();},[accessChanged]);
  function update(name:string,value:string,reset:string[]=[]) {
    const next=new URLSearchParams(search);if(value==="all"||!value)next.delete(name);else next.set(name,value);
    if(name!=="page")next.delete("page");reset.forEach(key=>next.delete(key));setSearch(next);
  }
  const teams=options.data?.teams??[];
  function unique(values:{id:number|null;name:string|null}[]) {
    const result=new Map<number,string>();values.forEach(item=>{if(item.id!=null)result.set(item.id,item.name||String(item.id));});
    return [...result].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
  }
  const catalog=options.data?.classes??teams.map(team=>({id:team.classId,code:team.classCode,name:team.className,
    programId:team.programId,programName:team.programName,cohortId:team.cohortId,cohortName:team.cohortName,studentCount:0,teamCount:1}));
  const programClasses=catalog.filter(c=>!filters.programId||c.programId===filters.programId);
  const cohortClasses=programClasses.filter(c=>!filters.cohortId||c.cohortId===filters.cohortId);
  const classTeams=teams.filter(team=>(!filters.programId||team.programId===filters.programId)
    &&(!filters.cohortId||team.cohortId===filters.cohortId)&&(!filters.classId||team.classId===filters.classId));
  const selectedClass=catalog.find(c=>c.id===filters.classId);
  const scopeKey=JSON.stringify({...filters,page:0});
  const changed=()=>{void client.invalidateQueries({queryKey:["project-alerts",owner]});void client.invalidateQueries({queryKey:["project-alert-history",owner]});};
  return <section className="min-w-0 space-y-5"><header><h1 className="flex items-center gap-2 text-xl font-semibold"><Bell className="size-5"/>Alerts</h1>
    <p className="mt-1 text-sm text-muted-foreground">Monitor upcoming milestones, overdue backlog items and tasks, and inactive members across your managed classes and teams.</p></header>
    {options.isPending?<p role="status">Loading class and team filters...</p>:options.isError?<Card><CardContent className="space-y-3 pt-6"><p role="alert">{getAlertError(options.error).message}</p>
      <Button variant="outline" onClick={()=>void options.refetch()}>Try again</Button></CardContent></Card>:<>
      <Card><CardContent className="space-y-4 pt-6"><div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect name="Program" value={filters.programId} values={unique(catalog.map(c=>({id:c.programId,name:c.programName})))} disabled={busy}
          onChange={value=>update("programId",value,["cohortId","classId","teamId","teamSearch"])}/>
        <FilterSelect name="Cohort" value={filters.cohortId} values={unique(programClasses.map(c=>({id:c.cohortId,name:c.cohortName})))} disabled={busy}
          onChange={value=>update("cohortId",value,["classId","teamId","teamSearch"])}/>
        <FilterSelect name="Class" value={filters.classId} values={unique(cohortClasses.map(c=>({id:c.id,name:`${c.name} · ${c.code}`})))} disabled={busy}
          onChange={value=>update("classId",value,["teamId","teamSearch"])}/>
        <FilterSelect name="Team" value={filters.teamId} values={classTeams.map(team=>({id:team.id,name:`${team.name} · ${team.classCode}`}))} disabled={busy}
          onChange={value=>update("teamId",value,["teamSearch"])}/>
      </div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="alert-team-search">Search teams</Label>
        <Input id="alert-team-search" placeholder="Team name or code..." disabled={busy} value={filters.teamSearch} onChange={event=>update("teamSearch",event.target.value,["teamId"])}/></div>
        {kind==="INACTIVE"?<>
          <div className="space-y-2"><Label>Activity status</Label><Select value={String(filters.inactiveOnly)} disabled={busy} onValueChange={value=>update("inactiveOnly",value)}>
            <SelectTrigger aria-label="Activity status" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="true">Inactive members only</SelectItem><SelectItem value="false">All current members</SelectItem></SelectContent>
          </Select></div><div className="space-y-2"><Label>Inactivity window</Label><p className="rounded-md border px-3 py-2 text-sm">{options.data.inactiveHours/24} days without starting a task</p></div>
        </>:<div className="space-y-2"><Label>Alert criteria</Label><p className="rounded-md border px-3 py-2 text-sm">{kind==="MILESTONE"?"Due within 48 hours · Below 80% Done":"Overdue · Not Done"}</p></div>}
      </div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Times shown in your browser's local time. Deadline calculations use {options.data.timeZone}.</p>
        <Button variant="ghost" disabled={busy} onClick={()=>setSearch({view:kind})}>Clear filters</Button></div></CardContent></Card>
      {selectedClass&&selectedClass.teamCount===0&&<Card><CardContent className="space-y-3 pt-6">
        <p role="status">{selectedClass.studentCount} enrolled student(s). This class has no active published teams yet.</p>
        <p className="text-sm text-muted-foreground">Publish teams using the existing class roster. Alerts will use their actual backlog items, milestones and task status history.</p>
        {(hasPermission("PEO_TEAM_ALLOCATE")||hasPermission("PRJ_WORKSPACE_MANAGE"))&&<Button asChild variant="outline"><Link to={`/team-allocation/classes/${selectedClass.id}`}>Open team allocation</Link></Button>}
      </CardContent></Card>}
      {!teams.length&&!catalog.length?<Card><CardContent className="py-10 text-center text-muted-foreground">No classes or active teams are assigned to you for monitoring.</CardContent></Card>:<>
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Alert categories">{kinds.map((value,index)=><Button key={value} variant="outline"
          className={`h-auto min-w-0 flex-col items-start gap-2 p-4 ${kind===value?"border-primary bg-primary/5":""}`}
          disabled={busy||!options.data.permissions[value+"_READ"]} onClick={()=>update("view",value)}>
          <span>{value==="INACTIVE"&&filters.inactiveOnly===false?"Team members":titles[value]}</span><span className="text-2xl font-semibold">{queries[index].isError?"—":queries[index].data?.total??"…"}</span>
        </Button>)}</div>
        {options.data.permissions[kind+"_READ"]?<AlertResults key={`${owner}:${kind}:${scopeKey}`} kind={kind} owner={owner} options={options.data}
          data={query.data} loading={query.isPending} fetching={query.isFetching} error={query.isError?query.error:undefined}
          page={filters.page} teamId={filters.teamId} inactiveOnly={filters.inactiveOnly!==false} busy={busy} onBusy={setBusy} onPage={page=>update("page",String(page))} onChanged={changed}
          reload={async()=>{const result=await query.refetch();return result.isSuccess?result.data:undefined;}}/>
          :<Card><CardContent className="py-8 text-center">You do not have permission to view this alert category. Select another category.</CardContent></Card>}
      </>}
    </>}
  </section>;
}
export default function ProjectAlertsPage() {
  const {user,activeRole}=usePermissions();
  return <MainLayout pathName={{management:"Management",alerts:"Alerts"}}><AlertConsole key={`${user.email}:${activeRole}`}/></MainLayout>;
}
