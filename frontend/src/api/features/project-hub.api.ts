import axiosInstance from "@/api/axios";
import type { ProjectMentor, ProjectTeam, TeamCharter } from "@/types/features/project-hub";

export const projectHubApi = {
  getTeams: async () => (await axiosInstance.get<ProjectTeam[]>("/project-hub/teams")).data,
  getMentors: async () => (await axiosInstance.get<ProjectMentor[]>("/project-hub/mentors")).data,
  assignMentor: async (id: number, mentorId: number | null) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/mentor`, { mentorId })).data,
  saveCharter: async (id: number, charter: TeamCharter) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/charter`, charter)).data,
};
