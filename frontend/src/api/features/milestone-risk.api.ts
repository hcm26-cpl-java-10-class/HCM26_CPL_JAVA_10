import axios from "@/api/axios";
import type { MilestoneRiskPage, MilestoneRiskResult, MilestoneRiskHistory } from "@/types/features/milestone-risk";
const base = (projectId: string) => `/projects/${projectId}/milestone-risks`;
export const milestoneRiskApi = {
  list: async (projectId: string, atRiskOnly: boolean, signal?: AbortSignal) =>
    (await axios.get<MilestoneRiskPage>(base(projectId), { params: { atRiskOnly }, signal })).data,
  send: async (projectId: string, milestoneId: string, input: { version: number; warningNote: string }, key: string) =>
    (await axios.post<MilestoneRiskResult>(base(projectId) + "/" + milestoneId + "/alerts", input,
      { headers: { "Idempotency-Key": key } })).data,
  history: async (projectId: string, milestoneId: string, signal?: AbortSignal) =>
    (await axios.get<MilestoneRiskHistory[]>(base(projectId) + "/" + milestoneId + "/alerts", { signal })).data,
};
