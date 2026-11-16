import { useQuery } from "@tanstack/react-query";
import { projectHubApi } from "@/api/features/project-hub.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { TeamCharter } from "@/types/features/project-hub";
import { CharterContent } from "./TeamCharterPage";
import { getWorkspaceError } from "./workspace.shared";
import { isAxiosError } from "axios";

/** Compatibility entry for existing embeds: use the same live contract and workflow as the full page. */
export function TeamCharterForm({teamId, canManage, onAccessChanged}: {
  teamId: number; initial?: TeamCharter; canManage?: boolean; onAccessChanged?: () => void;
}) {
  const {user, activeRole} = usePermissions();
  const query = useQuery({queryKey: ["team-charter", teamId, user.email, activeRole],
    queryFn: () => projectHubApi.getCharter(teamId), refetchOnWindowFocus: false, retry: false});
  if (query.isPending) return <p role="status">Loading team charter...</p>;
  const denied = isAxiosError(query.error) && [401, 403, 404].includes(query.error.response?.status ?? 0);
  if (!query.data || denied) return <Alert variant="destructive"><AlertDescription>{getWorkspaceError(query.error)}<Button variant="outline" onClick={() => { onAccessChanged?.(); void query.refetch(); }}>Try again</Button></AlertDescription></Alert>;
  return <CharterContent key={`${teamId}:${user.email}:${activeRole}`} view={{...query.data, canEdit: canManage !== false && query.data.canEdit}}
    onRefresh={async () => { await query.refetch(); }} />;
}
