import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
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
