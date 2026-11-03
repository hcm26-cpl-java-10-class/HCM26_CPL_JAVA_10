import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type UserRole = "ADMIN" | "TRAINER" | "TRAINEE";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type UserAccountStatus = UserStatus | "LOCKED";

export interface User extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  employeeCode?: string;
  phone?: string;
  description?: string;
  skills?: string[];
  status?: UserAccountStatus;
  lastLoginAt?: string;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  /** user_departments (N-N): optional. */
  departmentIds?: Array<string | number>;
}

export type UserDTO = User;

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
  departmentIds?: string[];
}

export const USER_STATUS_OPTIONS: Array<{ value: UserAccountStatus; label: string }> = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
];

export const USER_STATUS_DOT_CLASS: Record<UserAccountStatus, string> = {
  ACTIVE: "bg-emerald-500",
  LOCKED: "bg-orange-500",
  INACTIVE: "bg-slate-400",
};

export const USER_STATUS_BADGE_CLASS: Record<UserAccountStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  LOCKED: "bg-orange-50 text-orange-700",
  INACTIVE: "bg-slate-100 text-slate-600",
};

export const USER_STATUS_HEADER_CLASS: Record<UserAccountStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50/50",
  LOCKED: "border-orange-200 bg-orange-50/50",
  INACTIVE: "border-slate-200 bg-slate-50",
};
