import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
];

export interface UserDTO extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  description?: string;
  status?: UserStatus;

  roleIds?: Array<string | number>;

  departmentIds?: Array<string | number>;
}

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
  departmentIds?: string[];
}

export interface StudentSummaryDTO {
  id: number;
  email: string;
  fullName: string;
}
