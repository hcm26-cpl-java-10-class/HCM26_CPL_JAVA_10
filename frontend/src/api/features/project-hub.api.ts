import axiosInstance from "@/api/axios";
import type { ProjectMentor, ProjectTeam, TeamCharter, TeamCharterView, CharterHistoryPage, CharterRevisionRequest } from "@/types/features/project-hub";

export const projectHubApi = {
  getTeams: async () => (await axiosInstance.get<ProjectTeam[]>("/project-hub/teams")).data,
  getMentors: async () => (await axiosInstance.get<ProjectMentor[]>("/project-hub/mentors")).data,
  getCharter: async (id: number, workspaceId?: number) =>
    (await axiosInstance.get<TeamCharterView>(`/project-hub/teams/${id}/charter`, {params: {workspaceId}})).data,
  getCharterTeams: async () => (await axiosInstance.get<TeamCharterView[]>("/project-hub/charter-teams")).data,
  confirmCharter: async (id: number, request: CharterRevisionRequest) =>
    (await axiosInstance.post<TeamCharterView>(`/project-hub/teams/${id}/charter/confirm`, request)).data,
  approveCharter: async (id: number, request: CharterRevisionRequest) =>
    (await axiosInstance.post<TeamCharterView>(`/project-hub/teams/${id}/charter/approve`, request)).data,
  publishCharter: async (id: number, request: CharterRevisionRequest) =>
    (await axiosInstance.post<TeamCharterView>(`/project-hub/teams/${id}/charter/publish`, request)).data,
  getCharterHistory: async (id: number, page: number) =>
    (await axiosInstance.get<CharterHistoryPage>(`/project-hub/teams/${id}/charter/history`, {params: {page, size: 10}})).data,
  assignMentor: async (id: number, mentorId: number | null) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/mentor`, { mentorId })).data,
  saveCharter: async (id: number, charter: TeamCharter) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/charter`, charter)).data,
};
