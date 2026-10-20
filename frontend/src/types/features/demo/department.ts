import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface DepartmentDTO extends BaseDTO {
  name?: string;
  code?: string;
  description?: string;
}

export interface DepartmentFilter extends BaseFilter {
  name?: string;
  code?: string;
}

export interface DepartmentStats {
  members: number;
  enrolledCourses: number;
}

export interface DepartmentMember {
  id: number;
  email: string;
  firstName: string;
  lastName?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
}

export interface DepartmentMemberPage {
  content: DepartmentMember[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
