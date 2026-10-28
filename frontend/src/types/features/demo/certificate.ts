import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CertificateDTO extends BaseDTO {
    courseId?: number;
    courseName?: string;
    userId?: number;
    userFullName?: string;
    verificationToken?: string;
    issuedAt?: string;
}

export interface CertificateVerificationDTO {
    verificationToken?: string;
    courseName?: string;
    studentName?: string;
    issuedAt?: string;
    valid?: boolean;
}

export interface CertificateFilter extends BaseFilter {
    courseId?: number;
    name?: string;
    userId?: number;
    userName?: string;
}
