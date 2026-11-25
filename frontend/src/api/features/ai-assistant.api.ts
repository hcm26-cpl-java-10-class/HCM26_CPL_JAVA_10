import axiosInstance from "@/api/axios";
import type {
  AiSuggestionDetail,
  AiSuggestionListItem,
  AiSuggestionStatus,
  GenerateTemplateRequest,
  GenerateTemplateResponse,
  GeneratedTemplateOutput,
  ProjectTemplateApplyResult,
} from "@/types/features/ai-assistant";

const path = "/ai-assistant";
const GENERATION_TIMEOUT = { timeout: 120_000 };

export const aiAssistantApi = {
  async generateTemplate(request: GenerateTemplateRequest): Promise<GenerateTemplateResponse> {
    const response = await axiosInstance.post<GenerateTemplateResponse>(
      `${path}/templates/generate`,
      request,
      GENERATION_TIMEOUT,
    );
    return response.data;
  },

  async getSuggestions(status?: AiSuggestionStatus): Promise<AiSuggestionListItem[]> {
    const response = await axiosInstance.get<AiSuggestionListItem[]>(`${path}/suggestions`, {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  async getSuggestion(id: number): Promise<AiSuggestionDetail> {
    const response = await axiosInstance.get<AiSuggestionDetail>(`${path}/suggestions/${id}`);
    return response.data;
  },

  async updateSuggestion(id: number, output: GeneratedTemplateOutput): Promise<AiSuggestionDetail> {
    const response = await axiosInstance.put<AiSuggestionDetail>(`${path}/suggestions/${id}`, { output });
    return response.data;
  },

  async approveSuggestion(id: number): Promise<AiSuggestionDetail> {
    const response = await axiosInstance.patch<AiSuggestionDetail>(`${path}/suggestions/${id}/approve`);
    return response.data;
  },

  async rejectSuggestion(id: number, reason: string): Promise<AiSuggestionDetail> {
    const response = await axiosInstance.patch<AiSuggestionDetail>(
      `${path}/suggestions/${id}/reject`,
      { reason },
    );
    return response.data;
  },

  async applySuggestion(id: number): Promise<ProjectTemplateApplyResult> {
    const response = await axiosInstance.post<ProjectTemplateApplyResult>(
      `${path}/suggestions/${id}/apply`,
      {},
      GENERATION_TIMEOUT,
    );
    return response.data;
  },
};
