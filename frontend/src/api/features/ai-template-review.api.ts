import axiosInstance from "@/api/axios";
import type {
  AIReviewReportDetail,
  AIReviewReportListItem,
  AIReviewSuggestion,
  AIReviewSuggestionApplyResponse,
} from "@/types/features/ai-template-review";

const templatePath = (templateId: number | string) =>
  `/project-templates/${templateId}/reviews`;
const REVIEW_TIMEOUT = { timeout: 120_000 };

export const aiTemplateReviewApi = {
  async createReview(
    templateId: number | string,
    snapshotId: number,
  ): Promise<AIReviewReportDetail> {
    const response = await axiosInstance.post<AIReviewReportDetail>(
      templatePath(templateId),
      { snapshotId },
      REVIEW_TIMEOUT,
    );
    return response.data;
  },

  async getReports(templateId: number | string, signal?: AbortSignal): Promise<AIReviewReportListItem[]> {
    const response = await axiosInstance.get<AIReviewReportListItem[]>(
      templatePath(templateId),
      { signal },
    );
    return response.data;
  },

  async getReport(
    templateId: number | string,
    reportId: number | string,
    signal?: AbortSignal,
  ): Promise<AIReviewReportDetail> {
    const response = await axiosInstance.get<AIReviewReportDetail>(
      `${templatePath(templateId)}/${reportId}`,
      { signal },
    );
    return response.data;
  },

  async acceptFinding(templateId: number | string, reportId: number, findingId: number): Promise<void> {
    await axiosInstance.patch(`${templatePath(templateId)}/${reportId}/findings/${findingId}/accept`);
  },

  async dismissFinding(
    templateId: number | string,
    reportId: number,
    findingId: number,
    reason: string,
  ): Promise<void> {
    await axiosInstance.patch(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/dismiss`,
      { reason },
    );
  },

  async resolveFinding(templateId: number | string, reportId: number, findingId: number): Promise<void> {
    await axiosInstance.patch(`${templatePath(templateId)}/${reportId}/findings/${findingId}/resolve`);
  },

  async getSuggestions(
    templateId: number | string,
    reportId: number,
    findingId: number,
    signal?: AbortSignal,
  ): Promise<AIReviewSuggestion[]> {
    const response = await axiosInstance.get<AIReviewSuggestion[]>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions`,
      { signal },
    );
    return response.data;
  },

  async createSuggestion(templateId: number | string, reportId: number, findingId: number): Promise<AIReviewSuggestion> {
    const response = await axiosInstance.post<AIReviewSuggestion>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions`,
      {},
      REVIEW_TIMEOUT,
    );
    return response.data;
  },

  async regenerateSuggestion(
    templateId: number | string,
    reportId: number,
    findingId: number,
    suggestionId: number,
  ): Promise<AIReviewSuggestion> {
    const response = await axiosInstance.post<AIReviewSuggestion>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions/${suggestionId}/regenerate`,
      {},
      REVIEW_TIMEOUT,
    );
    return response.data;
  },

  async approveSuggestion(
    templateId: number | string,
    reportId: number,
    findingId: number,
    suggestionId: number,
  ): Promise<AIReviewSuggestion> {
    const response = await axiosInstance.patch<AIReviewSuggestion>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions/${suggestionId}/approve`,
    );
    return response.data;
  },

  async rejectSuggestion(
    templateId: number | string,
    reportId: number,
    findingId: number,
    suggestionId: number,
    reason: string,
  ): Promise<AIReviewSuggestion> {
    const response = await axiosInstance.patch<AIReviewSuggestion>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions/${suggestionId}/reject`,
      { reason },
    );
    return response.data;
  },

  async applySuggestion(
    templateId: number | string,
    reportId: number,
    findingId: number,
    suggestionId: number,
  ): Promise<AIReviewSuggestionApplyResponse> {
    const response = await axiosInstance.post<AIReviewSuggestionApplyResponse>(
      `${templatePath(templateId)}/${reportId}/findings/${findingId}/suggestions/${suggestionId}/apply`,
      {},
      REVIEW_TIMEOUT,
    );
    return response.data;
  },
};
