
import axiosInstance from "@/api/axios";

import type {
  CertificateInsightCellDetail,
  CertificateInsightsHeatmap,
  CertificateInsightsOverview,
} from "@/types/features/demo/certificate-insights";

const path = "/certificates/insights";

export const certificateInsightsApi = {

  getOverview: async (): Promise<CertificateInsightsOverview> => {
    const response =
      await axiosInstance.get<CertificateInsightsOverview>(
        `${path}/overview`
      );

    return response.data;
  },

  getHeatmap: async (): Promise<CertificateInsightsHeatmap> => {
    const response =
      await axiosInstance.get<CertificateInsightsHeatmap>(
        `${path}/heatmap`
      );

    return response.data;
  },

  getCellDetail: async (
    departmentId: number,
    categoryId: number
  ): Promise<CertificateInsightCellDetail> => {

    const response =
      await axiosInstance.get<CertificateInsightCellDetail>(
        `${path}/cells/${departmentId}/${categoryId}`
      );

    return response.data;
  }
};
