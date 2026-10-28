import axios from "@/api/axios";
import type { AlertFilters, AlertHistory, AlertKind, AlertOptions, AlertPage, AlertPayload, AlertResult, MemberWorkDetail } from "@/types/features/project-alert";
const base = "/project-alerts";
const paths: Record<AlertKind, string> = { BACKLOG: "backlog", MILESTONE: "milestones", INACTIVE: "inactive-members" };
export const projectAlertApi = {
  options: async (signal?: AbortSignal) => (await axios.get<AlertOptions>(base + "/options", { signal })).data,
  list: async (kind: AlertKind, params: AlertFilters, signal?: AbortSignal) =>
    (await axios.get<AlertPage>(`${base}/${paths[kind]}`, { params, signal })).data,
  send: async (payload: AlertPayload, key: string) =>
    (await axios.post<AlertResult>(base + "/send", payload, { headers: { "Idempotency-Key": key } })).data,
  history: async (team: number, kind: AlertKind, signal?: AbortSignal) =>
    (await axios.get<AlertHistory[]>(`${base}/teams/${team}/history`, { params: { kind }, signal })).data,
  memberWork: async (team:number,userId:string,signal?:AbortSignal) =>
    (await axios.get<MemberWorkDetail>(`${base}/teams/${team}/members/${userId}/work-results`,{signal})).data,
};
