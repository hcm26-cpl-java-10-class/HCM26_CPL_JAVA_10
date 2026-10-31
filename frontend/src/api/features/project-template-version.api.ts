import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { TemplateVersionConfiguration } from "@/types/features/project-template-version";
import type { ProjectTemplatePayload, TemplateTeamConstraintsPayload, TemplateMilestonePlanPayload, TemplateSampleContentPayload, TemplateBacklogInput } from "@/types/features/project-template";
import type {
  ProjectTemplateVersionAuditLog,
  ProjectTemplateVersionDTO,
  ProjectTemplateVersionFilter,
} from "@/types";

const path = "/project-template-versions";

const base = createBaseApiService<
  ProjectTemplateVersionDTO,
  ProjectTemplateVersionFilter
>({
  path: path,
});

export const projectTemplateVersionApi = Object.assign({}, base, {
  async getConfiguration(id: number, signal?: AbortSignal): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.get<TemplateVersionConfiguration>(`${path}/${id}/configuration`, { signal })).data;
  },
  async saveOverview(id: number, payload: ProjectTemplatePayload): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.put<TemplateVersionConfiguration>(`${path}/${id}/configuration/overview`, payload)).data;
  },
  async saveTeam(id: number, payload: TemplateTeamConstraintsPayload): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.put<TemplateVersionConfiguration>(`${path}/${id}/configuration/team-constraints`, payload)).data;
  },
  async saveMilestones(id: number, payload: TemplateMilestonePlanPayload): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.put<TemplateVersionConfiguration>(`${path}/${id}/configuration/milestones`, payload)).data;
  },
  async saveBacklog(id: number, payload: TemplateSampleContentPayload): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.put<TemplateVersionConfiguration>(`${path}/${id}/configuration/sample-content`, payload)).data;
  },
  async publish(id: number, lockVersion: number): Promise<TemplateVersionConfiguration> {
    return (await axiosInstance.post<TemplateVersionConfiguration>(`${path}/${id}/publish`, { lockVersion })).data;
  },
  async previewBacklogImport(id: number, file: File): Promise<TemplateBacklogInput[]> {
    const form = new FormData(); form.append("file", file);
    return (await axiosInstance.post<TemplateBacklogInput[]>(`${path}/${id}/backlog-import-preview`, form,
      { headers: { "Content-Type": undefined } })).data;
  },
  async getBacklogImportTemplate(id: number): Promise<Blob> {
    return (await axiosInstance.get<Blob>(`${path}/${id}/backlog-import-template`, { responseType: "blob" })).data;
  },
  /**
   * US-07: seeds the baseline `v1.0` / `DRAFT` version of a template that does
   * not own any version yet (template created before the version chain was
   * wired to the Project Template module).
   */
  createInitialVersion: async (
    templateId: number | string,
  ): Promise<ProjectTemplateVersionDTO | null> => {
    const response = await axiosInstance.post<ProjectTemplateVersionDTO | null>(
      `${path}/by-template/${templateId}/initial-version`,
    );
    return response.data ?? null;
  },

  /**
   * US-07: creates the next version (`v1.0 -> v2.0`) from an existing one.
   * The server copies the configuration, stores the new row as `DRAFT` and
   * links `parentTemplateId` back to the source version.
   */
  createNewVersion: async (
    sourceVersionId: number | string,
  ): Promise<ProjectTemplateVersionDTO> => {
    const response = await axiosInstance.post<ProjectTemplateVersionDTO>(
      `${path}/${sourceVersionId}/new-version`,
    );
    return response.data;
  },

  /**
   * US-08: duplicates the template behind this version into a brand new,
   * independent template. The server stores the copy as `v1.0` / `DRAFT`,
   * copies the configuration and keeps no `parentTemplateId` link.
   */
  duplicateTemplate: async (
    sourceVersionId: number | string,
    payload: { name: string },
  ): Promise<ProjectTemplateVersionDTO> => {
    const response = await axiosInstance.post<ProjectTemplateVersionDTO>(
      `${path}/${sourceVersionId}/duplicate`,
      payload,
    );
    return response.data;
  },

  /**
   * Every version of a project template, newest first.
   */
  getByTemplate: async (
    templateId: number | string,
  ): Promise<ProjectTemplateVersionDTO[]> => {
    const response = await axiosInstance.get<ProjectTemplateVersionDTO[]>(
      `${path}/by-template/${templateId}`,
    );
    return response.data;
  },

  /**
   * Audit trail of a version (actor, timestamp, before/after state).
   */
  getAuditLogs: async (
    id: number | string,
  ): Promise<ProjectTemplateVersionAuditLog[]> => {
    const response = await axiosInstance.get<ProjectTemplateVersionAuditLog[]>(
      `${path}/${id}/audit-logs`,
    );
    return response.data;
  },
});
