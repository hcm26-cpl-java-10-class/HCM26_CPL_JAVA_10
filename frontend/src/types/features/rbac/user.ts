import type { BaseDTO, BaseFilter } from "@/types/common/base";

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
  phone?: string;
  description?: string;
  /** Date in the format yyyy-MM-dd, for example 2000-01-31. Optional. */
  dateOfBirth?: string;
  gender?: Gender;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  /** user_departments (N-N): optional. */
  departmentIds?: Array<string | number>;
}

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
  departmentIds?: string[];
}
