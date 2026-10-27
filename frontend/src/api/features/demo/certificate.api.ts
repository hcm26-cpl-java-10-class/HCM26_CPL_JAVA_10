import { createBaseApiService } from "@/api/base-service.api";
import type { CertificateDTO, CertificateFilter } from "@/types";

const path = "/certificates";

const base = createBaseApiService<CertificateDTO, CertificateFilter>({
  path: path,
});

export const certificateApi = Object.assign({}, base, {});
