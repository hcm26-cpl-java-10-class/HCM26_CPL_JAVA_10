import axiosInstance from "@/api/axios";
import type { ManagedTeamMember, TeamMemberOption, TeamMembershipUpdate, ProjectMentor, ProjectTeam, TeamCharter } from "@/types/features/project-hub";

export const projectHubApi = {
  getMembers: async (teamId: number) => (await axiosInstance.get<ManagedTeamMember[]>(`/project-hub/teams/${teamId}/members`)).data,
  getMemberOptions: async (teamId: number) => (await axiosInstance.get<TeamMemberOption[]>(`/project-hub/teams/${teamId}/member-options`)).data,
  saveMember: async (teamId: number, userId: number, update: TeamMembershipUpdate) =>
    (await axiosInstance.put<ManagedTeamMember>(`/project-hub/teams/${teamId}/members/${userId}`, update)).data,
  getTeams: async () => (await axiosInstance.get<ProjectTeam[]>("/project-hub/teams")).data,
  getMentors: async () => (await axiosInstance.get<ProjectMentor[]>("/project-hub/mentors")).data,
  assignMentor: async (id: number, mentorId: number | null) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/mentor`, { mentorId })).data,
  saveCharter: async (id: number, charter: TeamCharter) =>
    (await axiosInstance.put<ProjectTeam>(`/project-hub/teams/${id}/charter`, charter)).data,
};
