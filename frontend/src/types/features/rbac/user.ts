import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type UserRole = "ADMIN" | "TRAINER" | "TRAINEE";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type UserAccountStatus = UserStatus | "LOCKED";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Other", value: "OTHER" },
];

export interface UserDTO extends BaseDTO {
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
  /** Date in the format yyyy-MM-dd, for example 2000-01-31. Optional. */
  dateOfBirth?: string;
  gender?: Gender;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  /** user_departments (N-N): optional. */
  departmentIds?: Array<string | number>;
}

export type User = UserDTO;

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
