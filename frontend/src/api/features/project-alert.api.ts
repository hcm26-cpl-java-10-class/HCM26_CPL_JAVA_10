import axios from "@/api/axios";
import type { AlertFilters, AlertHistory, AlertKind, AlertOptions, AlertPage, AlertPayload, AlertResult, WorkspaceAlertPage } from "@/types/features/project-alert";
const base = "/project-alerts";
const paths: Record<AlertKind, string> = { BACKLOG: "backlog", MILESTONE: "milestones" };
export const projectAlertApi = {
  options: async (signal?: AbortSignal) => (await axios.get<AlertOptions>(base + "/options", { signal })).data,
  list: async (kind: AlertKind, params: AlertFilters, signal?: AbortSignal) =>
    (await axios.get<AlertPage>(`${base}/${paths[kind]}`, { params, signal })).data,
  send: async (payload: AlertPayload, key: string) =>
    (await axios.post<AlertResult>(base + "/send", payload, { headers: { "Idempotency-Key": key } })).data,
  history: async (team: number, kind: AlertKind, signal?: AbortSignal) =>
    (await axios.get<AlertHistory[]>(`${base}/teams/${team}/history`, { params: { kind }, signal })).data,
  sentInWorkspace: async (workspaceId: number, params: { page: number; size: number; kind?: AlertKind }, signal?: AbortSignal) =>
    (await axios.get<WorkspaceAlertPage>(`/workspaces/${workspaceId}/alerts`, { params, signal })).data,
};
