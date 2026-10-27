import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { CertificateDTO, CertificateFilter } from "@/types";

const path = "/certificates";

const base = createBaseApiService<CertificateDTO, CertificateFilter>({
  path: path,
});

export const certificateApi = Object.assign({}, base, {
  getMyCertificates: async (): Promise<CertificateDTO[]> => {
    const response = await axiosInstance.get<CertificateDTO[]>(
      `${path}/my-certificates`
    );
    return response.data;
  },

  verify: async (verificationToken: string): Promise<CertificateDTO> => {
    const response = await axiosInstance.get<CertificateDTO>(
      `${path}/verify/${encodeURIComponent(verificationToken)}`
    );
    return response.data;
  },
});
