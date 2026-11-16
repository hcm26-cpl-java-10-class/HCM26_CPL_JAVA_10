import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, FolderTree, Plus } from "lucide-react";
import { useState } from "react";
import axiosInstance from "@/api/axios";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ProjectTemplateStatus } from "@/types/features/project-template";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";
import { TemplateActivationDialog } from "./TemplateActivationDialog";

interface TemplateNode {
  id: number;
  parentTemplateId: number | null;
  code: string;
  name: string;
  status: ProjectTemplateStatus;
  templateVersion: number;
  versionId: number | null;
  modules: TemplateNode[];
}

function ModuleNode({ node, historical, onActivated }: {
  node: TemplateNode; historical: boolean; onActivated?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const url = historical && node.versionId ? `/project-templates/${node.id}/detail?tab=versions&version=${node.versionId}`
    : `/project-templates/${node.id}/detail`;
  return <Collapsible asChild open={expanded} onOpenChange={setExpanded}><li className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="min-w-0 space-y-1"><Link to={url} className="break-words text-sm font-semibold hover:underline">{node.name}</Link>
        <p className="break-words text-xs text-muted-foreground">{node.code} · Version {node.templateVersion}</p></div>
      <div className="flex flex-wrap items-center gap-2"><ProjectTemplateStatusBadge status={node.status} />
        {onActivated && node.status === "DRAFT" && <TemplateActivationDialog row template={node}
          onActivated={onActivated} onOpenSection={section => navigate(`/project-templates/${node.id}/detail?tab=${section}`)} />}
        {node.modules.length > 0 && <CollapsibleTrigger asChild><Button type="button" variant="outline" size="sm"
          aria-label={`${expanded ? "Hide" : "Show"} modules for ${node.name}`}>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {expanded ? "Hide modules" : "Show modules"} ({node.modules.length})
        </Button></CollapsibleTrigger>}
      </div>
    </div>
    {node.modules.length > 0 && <CollapsibleContent asChild><ul className="ml-3 space-y-3 border-l pl-3 sm:ml-5 sm:pl-5">
      {node.modules.map(child => <ModuleNode key={child.id} node={child} historical={historical} onActivated={onActivated} />)}
    </ul></CollapsibleContent>}
  </li></Collapsible>;
}

export function TemplateModulesPanel({ templateId, canCreate, canActivate = false, versionId, historical = false }: {
  templateId: number; canCreate: boolean; canActivate?: boolean; versionId?: number; historical?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["project-templates", user.email, activeRole, "hierarchy", templateId, versionId],
    queryFn: async ({ signal }) => (await axiosInstance.get<TemplateNode>(`/project-templates/${templateId}/hierarchy`,
      { params: { versionId }, signal })).data, retry: false, refetchOnWindowFocus: false });
  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { modules } = query.data;
  const master = query.data.parentTemplateId == null;
  const activeCount = modules.filter(module => module.status === "ACTIVE" && module.versionId != null).length;
  const refresh = canActivate && master && !historical ? () => {
    for (const key of ["project-templates", "project-template-versions", "master-assignment-templates", "template-candidates"]) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  } : undefined;
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
    <CardTitle className="flex items-center gap-2"><FolderTree className="size-5" />Modules</CardTitle>
    {canCreate && master && <Button variant="outline" asChild><Link to={`/project-templates/create?parentTemplateId=${templateId}`}>
      <Plus />Add module</Link></Button>}</div>
    <CardDescription>{modules.length && master && !historical
      ? `${activeCount}/${modules.length} direct modules active. Activate all child modules before publishing the Master.`
      : "Each module has its own team constraints, milestones, rubric, resources and versions."}</CardDescription>
  </CardHeader><CardContent>
    {modules.length > 0 ? <ul className="space-y-3" aria-label="Template modules">
      {modules.map(module => <ModuleNode key={module.id} node={module} historical={historical} onActivated={refresh} />)}
    </ul> : <p className="text-sm text-muted-foreground">No child modules configured.</p>}
  </CardContent></Card>;
}
