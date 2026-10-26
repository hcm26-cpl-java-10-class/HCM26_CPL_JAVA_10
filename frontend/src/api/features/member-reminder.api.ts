import axios from "@/api/axios";
import type { InactiveMemberPage, MemberReminderResult, MemberReminderHistory } from "@/types/features/member-reminder";
const base = (projectId: string) => `/projects/${projectId}/inactive-members`;
export const memberReminderApi = {
  list: async (projectId: string, inactiveOnly: boolean, signal?: AbortSignal) =>
    (await axios.get<InactiveMemberPage>(base(projectId), { params: { inactiveOnly }, signal })).data,
  send: async (projectId: string, payload: { recipientUserIds: number[]; warningNote: string }, key: string) =>
    (await axios.post<MemberReminderResult>(base(projectId) + "/reminders", payload, { headers: { "Idempotency-Key": key } })).data,
  history: async (projectId: string, userId: number, signal?: AbortSignal) =>
    (await axios.get<MemberReminderHistory[]>(base(projectId) + "/" + userId + "/reminders", { signal })).data,
};
