import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CertificateDTO extends BaseDTO {
    courseId?: number;
    courseName?: string;
    userId?: number;
    userFirstName?: string;
    userLastName?: string;
    certificateNumber?: string;
    issuedAt?: string;
}

export interface CertificateFilter extends BaseFilter {
    courseId?: number;
    name?: string;
    userId?: number;
    userName?: string;
}
