import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
];

export const USER_STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  LOCKED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  INACTIVE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const USER_STATUS_DOT_CLASS: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-500",
  LOCKED: "bg-amber-500",
  INACTIVE: "bg-slate-500",
};

export const USER_STATUS_HEADER_CLASS: Record<UserStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
  LOCKED: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
  INACTIVE: "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30",
};

export interface UserDTO extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  employeeCode?: string;
  lastLoginAt?: string;
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
