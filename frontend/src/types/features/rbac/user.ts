import type { BaseDTO, BaseFilter } from "@/types/common/base";

/** Khớp enum UserStatus trong class diagram. */
export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
];

/** Màu badge: xanh = hoạt động, đỏ = bị khóa, xám = ngưng hoạt động. */
export const USER_STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25 dark:bg-emerald-500/15 dark:text-emerald-400",
  LOCKED: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/25 dark:bg-red-500/15 dark:text-red-400",
  INACTIVE: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/30 dark:bg-slate-500/25 dark:text-slate-300",
};

/** Nền + viền khối đầu trang chi tiết theo trạng thái. */
export const USER_STATUS_HEADER_CLASS: Record<UserStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  LOCKED: "border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10",
  INACTIVE: "border-slate-200 bg-slate-50 dark:border-slate-500/30 dark:bg-slate-500/10",
};

export const USER_STATUS_DOT_CLASS: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-500",
  LOCKED: "bg-red-500",
  INACTIVE: "bg-slate-400",
};

export interface UserDTO extends BaseDTO {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  employeeCode?: string;
  phone?: string;
  description?: string;
  status?: UserStatus;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  /** user_departments (N-N): optional. */
  departmentIds?: Array<string | number>;
  lastLoginAt?: string;
}

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
  departmentIds?: string[];
  status?: UserStatus;
}
