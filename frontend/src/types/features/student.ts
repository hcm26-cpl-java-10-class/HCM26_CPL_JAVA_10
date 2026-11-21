import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED";
export interface StudentDTO extends BaseDTO {
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  trainingClassIds?: number[];
  trainingClass?: string;
  className?: string;
  address?: string;
  status?: StudentStatus;
}
export interface StudentFilter extends BaseFilter {
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  trainingClass?: string;
  className?: string;
  status?: StudentStatus;
}
