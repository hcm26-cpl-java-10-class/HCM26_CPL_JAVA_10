import type { Gender, UserDTO } from "@/types";

export interface UserFormData {
  fullName: string;
  username: string;
  email: string;
  employeeCode: string;
  roleIds: string[];
  roles: string[];
  departmentIds: string[];
  status: "ACTIVE" | "INACTIVE";
  skills: string[];
  description: string;
}

export function toUserPayload(data: UserFormData, initialData: UserDTO | null): UserDTO {
  const nameParts = data.fullName.trim().split(/\s+/);
  const firstName = nameParts.pop() ?? "";
  const lastName = nameParts.join(" ");
  const toPositiveIds = (ids: string[]) =>
    ids
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id) && id > 0);
  return {
    ...initialData,
    firstName,
    lastName,
    username: data.username.trim(),
    email: data.email,
    employeeCode: data.employeeCode,
    status: data.status,
    isActive: data.status === "ACTIVE",
    roleIds: toPositiveIds(data.roleIds),
    departmentIds: toPositiveIds(data.departmentIds),
    skills: data.skills,
    description: data.description,
  };
}

export type UserFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  employeeCode: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | "";
  password: string;
  confirmPassword: string;
  description: string;
  status: NonNullable<UserDTO["status"]>;
  roleIds: Array<string | number>;
  departmentIds: Array<string | number>;
};

export type FieldErrors = Partial<Record<keyof UserFormValues, string[]>>;

export const emptyUserForm: UserFormValues = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  employeeCode: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  password: "",
  confirmPassword: "",
  description: "",
  status: "ACTIVE",
  roleIds: [],
  departmentIds: [],
};

export function toFormValues(dto?: UserDTO): UserFormValues {
  if (!dto) return emptyUserForm;
  return {
    firstName: dto.firstName ?? "",
    lastName: dto.lastName ?? "",
    username: dto.username ?? "",
    email: dto.email ?? "",
    employeeCode: dto.employeeCode ?? "",
    phone: dto.phone ?? "",
    dateOfBirth: dto.dateOfBirth ?? "",
    gender: dto.gender ?? "",
    password: "",
    confirmPassword: "",
    description: dto.description ?? "",
    status: dto.status ?? (dto.isActive === false ? "INACTIVE" : "ACTIVE"),
    roleIds: dto.roleIds ?? [],
    departmentIds: dto.departmentIds ?? [],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,50}$/;
const PHONE_RE = /^(\+?\d{8,15})$/;

/** True for a real calendar date written as yyyy-MM-dd; month and day may omit the leading zero (2000-1-5). */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** 2000-1-5 -> 2000-01-05, the form the backend reads. Anything else is returned as it is. */
function normalizeIsoDate(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : text;
}

/** Validate phía client; trả về lỗi theo từng trường (rỗng = hợp lệ). */
export function validateUserForm(v: UserFormValues, mode: "create" | "edit"): FieldErrors {
  const e: FieldErrors = {};
  const add = (k: keyof UserFormValues, msg: string) => (e[k] = [...(e[k] ?? []), msg]);

  if (!v.firstName.trim()) add("firstName", "Họ tên là bắt buộc");
  if (!v.username.trim()) add("username", "Username là bắt buộc");
  else if (!USERNAME_RE.test(v.username.trim()))
    add("username", "Username 3-50 ký tự, chỉ gồm chữ, số, . _ -");
  if (!v.email.trim()) add("email", "Email là bắt buộc");
  else if (!EMAIL_RE.test(v.email.trim())) add("email", "Email không hợp lệ");
  if (!v.employeeCode.trim()) add("employeeCode", "Mã nhân viên là bắt buộc");
  if (v.phone.trim() && !PHONE_RE.test(v.phone.replace(/[\s.-]/g, "")))
    add("phone", "Số điện thoại không hợp lệ");
  // Bắt buộc khi tạo mới. Khi sửa, để trống = giữ nguyên giá trị cũ.
  const dob = v.dateOfBirth.trim();
  if (!dob) {
    if (mode === "create") add("dateOfBirth", "Ngày sinh là bắt buộc");
  } else if (!isValidIsoDate(dob)) add("dateOfBirth", "Ngày sinh phải theo định dạng yyyy-MM-dd, ví dụ 2000-01-31");
  else if (normalizeIsoDate(dob)! > new Date().toISOString().slice(0, 10))
    add("dateOfBirth", "Ngày sinh không được ở tương lai");
  if (!v.gender && mode === "create") add("gender", "Giới tính là bắt buộc");

  if (mode === "create" && !v.password) add("password", "Mật khẩu là bắt buộc");
  if (v.password && v.password.length < 8) add("password", "Mật khẩu tối thiểu 8 ký tự");
  if (v.password && v.password !== v.confirmPassword)
    add("confirmPassword", "Mật khẩu xác nhận không khớp");

  if (v.roleIds.length === 0) add("roleIds", "Chọn ít nhất 1 role");
  return e;
}

export function toPayload(v: UserFormValues, mode: "create" | "edit"): UserDTO {
  const payload: UserDTO = {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    username: v.username.trim(),
    email: v.email.trim(),
    employeeCode: v.employeeCode.trim(),
    phone: v.phone.trim(),
    dateOfBirth: normalizeIsoDate(v.dateOfBirth),
    gender: v.gender || undefined,
    description: v.description.trim(),
    status: v.status,
    isActive: v.status === "ACTIVE",
    roleIds: v.roleIds,
    departmentIds: v.departmentIds,
  };
  if (v.password || mode === "create") payload.password = v.password;
  return payload;
}

/** Lấy lỗi validate theo trường từ response BE ({ errors: { field: [msg] } }). */
export function extractServerErrors(error: unknown): { fieldErrors: FieldErrors; message: string } {
  const responseData =
    typeof error === "object" && error !== null && "response" in error
      ? error.response
      : undefined;
  const data =
    typeof responseData === "object" && responseData !== null && "data" in responseData
      ? responseData.data
      : undefined;
  const errorData =
    typeof data === "object" && data !== null
      ? (data as { errors?: unknown; message?: unknown })
      : undefined;
  const fieldErrors =
    typeof errorData?.errors === "object" && errorData.errors !== null
      ? (errorData.errors as FieldErrors)
      : {};
  const message =
    typeof errorData?.message === "string"
      ? errorData.message
      : "Đã có lỗi xảy ra, vui lòng thử lại.";

  return {
    fieldErrors,
    message,
  };
}

export function extractDetailedServerError(error: unknown): string {
  const responseData =
    typeof error === "object" && error !== null && "response" in error
      ? error.response
      : undefined;
  const data =
    typeof responseData === "object" && responseData !== null && "data" in responseData
      ? responseData.data
      : undefined;

  if (typeof data === "object" && data !== null) {
    const response = data as { message?: unknown; errors?: unknown };
    if (typeof response.message === "string" && response.message) {
      return response.message;
    }
    if (response.errors !== undefined) {
      return JSON.stringify(response.errors) || extractServerErrors(error).message;
    }
  }
  return extractServerErrors(error).message;
}
