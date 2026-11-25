import type { BaseDTO, BaseFilter } from "@/types/common/base";

/** Khß╗¢p enum UserStatus trong class diagram. */
export type UserStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Hoß║ít ─æß╗Öng" },
  { value: "LOCKED", label: "Bß╗ï kh├│a" },
  { value: "INACTIVE", label: "Ng╞░ng hoß║ít ─æß╗Öng" },
];

/** M├áu badge theo trß║íng th├íi. */
export const USER_STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  ACTIVE:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25 dark:bg-emerald-500/15 dark:text-emerald-400",
  LOCKED:
    "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/25 dark:bg-red-500/15 dark:text-red-400",
  INACTIVE:
    "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/30 dark:bg-slate-500/25 dark:text-slate-300",
};

/** Nß╗ün + viß╗ün khß╗æi ─æß║ºu trang chi tiß║┐t theo trß║íng th├íi. */
export const USER_STATUS_HEADER_CLASS: Record<UserStatus, string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  LOCKED:
    "border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10",
  INACTIVE:
    "border-slate-200 bg-slate-50 dark:border-slate-500/30 dark:bg-slate-500/10",
};

export const USER_STATUS_DOT_CLASS: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-500",
  LOCKED: "bg-red-500",
  INACTIVE: "bg-slate-400",
};

export type Gender = "MALE" | "FEMALE" | "OTHER";

export const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Other", value: "OTHER" },
];

export interface UserDTO extends BaseDTO {
  username?: string;
  email?: string;
  userCode?: string | null;
  password?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  employeeCode?: string;
  phone?: string;
  description?: string;
  status?: UserStatus;
  /** Date in the format yyyy-MM-dd, for example 2000-01-31. Optional. */
  dateOfBirth?: string;
  gender?: Gender;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  departmentIds?: Array<string | number>;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentNames?: string[];
  clearDepartment?: boolean;
  lastLoginAt?: string;
}

export interface UserFilter extends BaseFilter {
  departmentId?: number;
  roleIds?: Array<string | number>;
  departmentIds?: Array<string | number>;
  status?: UserStatus;
}

export interface StudentSummaryDTO {
  id: number;
  email: string;
  fullName: string;
}
