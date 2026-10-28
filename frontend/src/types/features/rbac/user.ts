import type { BaseDTO, BaseFilter } from "@/types/common/base";

/** Khớp enum UserStatus trong class diagram. */
export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
];

export interface UserDTO extends BaseDTO {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  phone?: string;
  description?: string;
  status?: UserStatus;
  /** Quan hệ N-N user_roles (ít nhất 1 role). */
  roleIds?: Array<string | number>;
  /** Quan hệ N-N user_departments. */
  departmentIds?: Array<string | number>;
  lastLoginAt?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentNames?: string[];
  clearDepartment?: boolean;
}

export interface UserFilter extends BaseFilter {
  departmentId?: number;
  roleIds?: Array<string | number>;
  departmentIds?: Array<string | number>;
  status?: UserStatus;
}
