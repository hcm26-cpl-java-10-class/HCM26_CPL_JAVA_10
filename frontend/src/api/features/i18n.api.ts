import axiosInstance from "@/api/axios";
import type { TranslateResponse } from "@/types/features/i18n";

export interface TranslatePayload {
  targetLanguage: string;
  sourceLanguage?: string;
  texts: string[];
}

export const i18nApi = {
  /**
   * Dịch một danh sách chuỗi.
   *
   * Endpoint này dùng cache phía server, nên gọi lại với cùng chuỗi gần như không tốn
   * thêm request ra ngoài.
   */
  translate: async (payload: TranslatePayload): Promise<TranslateResponse> => {
    const response = await axiosInstance.post<TranslateResponse>("/i18n/translate", payload);
    return response.data;
  },
};
