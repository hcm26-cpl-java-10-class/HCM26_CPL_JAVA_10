import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { workspaceApi } from "@/api/features/workspace.api";
import { projectAlertApi } from "@/api/features/project-alert.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/usePermissions";

export function MilestoneEntryPage() {
  const {user,activeRole,hasPermission}=usePermissions(),navigate=useNavigate();
  const [classId,setClassId]=useState(""),[teamId,setTeamId]=useState("");
  const query=useQuery({queryKey:["milestone-team-directory",user.email,activeRole],retry:false,gcTime:0,
    queryFn:async()=>{
      const [workspace,alerts]=await Promise.allSettled([workspaceApi.getCandidates(),
        hasPermission("PROJECT_ALERT_READ")?projectAlertApi.options():Promise.resolve(undefined)]);
      if(workspace.status==="rejected"&&(alerts.status==="rejected"||!alerts.value))throw workspace.reason;
      const teams=new Map<number,{id:number;name:string;classId:number;workspaceId?:number}>();
      const classes=new Map<number,{id:number;name:string;studentCount?:number}>();
      if(workspace.status==="fulfilled")for(const row of workspace.value)if(row.classId){
        classes.set(row.classId,{id:row.classId,name:`${row.className??row.classCode??row.classId}`});
        teams.set(row.teamId,{id:row.teamId,name:row.teamName??row.teamCode??String(row.teamId),classId:row.classId,workspaceId:row.workspaceId});
      }
      if(alerts.status==="fulfilled"&&alerts.value){
        for(const c of alerts.value.classes??[])classes.set(c.id,{id:c.id,name:`${c.name} · ${c.code}`,studentCount:c.studentCount});
        for(const row of alerts.value.teams)teams.set(row.id,{id:row.id,name:row.name,classId:row.classId,workspaceId:teams.get(row.id)?.workspaceId});
      }
      return {classes:[...classes.values()].sort((a,b)=>a.name.localeCompare(b.name)),teams:[...teams.values()]};
    }});
  const teams=query.data?.teams.filter(team=>String(team.classId)===classId)??[];
  const selectedClass=query.data?.classes.find(c=>String(c.id)===classId);
  const selectedTeam=teams.find(team=>String(team.id)===teamId);
  return <MainLayout pathName={{milestones:"Milestones"}}><Card>
    <CardHeader><CardTitle><h1>Milestones</h1></CardTitle><p className="text-sm text-muted-foreground">Select a class and team to view their configured milestones.</p></CardHeader>
    <CardContent className="space-y-5">
      {query.isPending?<p role="status">Loading your classes and teams...</p>:query.isError?<div className="space-y-3">
        <p role="alert" className="text-destructive">Could not load your classes and teams.</p><Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button>
      </div>:!query.data.classes.length?<p>No classes or teams are available in your data scope.</p>:<>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Class</Label>
          <Select value={classId} onValueChange={value=>{setClassId(value);setTeamId("");}}><SelectTrigger aria-label="Milestone class"><SelectValue placeholder="Select a class"/></SelectTrigger>
            <SelectContent>{query.data.classes.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Team</Label><Select value={teamId} disabled={!teams.length} onValueChange={setTeamId}>
            <SelectTrigger aria-label="Milestone team"><SelectValue placeholder="Select a team"/></SelectTrigger><SelectContent>{teams.map(team=><SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>)}</SelectContent>
          </Select></div></div>
        {selectedClass&&!teams.length&&<div className="space-y-3 rounded-md border p-4"><p role="status">{selectedClass.studentCount??0} enrolled student(s). This class has no active published teams yet.</p>
          {(hasPermission("PEO_TEAM_ALLOCATE")||hasPermission("PRJ_WORKSPACE_MANAGE"))&&<Button asChild variant="outline"><Link to={`/team-allocation/classes/${selectedClass.id}`}>Open team allocation</Link></Button>}
        </div>}
        <Button disabled={!selectedTeam?.workspaceId} onClick={()=>navigate(`/management/workspaces/${selectedTeam?.workspaceId}?tab=milestones`)}>Open workspace milestones</Button>
        {selectedTeam&&!selectedTeam.workspaceId&&<p className="text-sm text-muted-foreground">This team does not have a workspace yet.</p>}
      </>}
    </CardContent></Card></MainLayout>;
}
