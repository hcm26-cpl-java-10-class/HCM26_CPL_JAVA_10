import axiosInstance from "@/api/axios";
import type {
  GenerateTemplateRequest,
  GenerateTemplateResponse,
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
};
