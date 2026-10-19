import type { UserDTO } from "@/types";

export type UserFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  employeeCode: string;
  phone: string;
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
    description: v.description.trim(),
    status: v.status,
    isActive: v.status === "ACTIVE",
    roleIds: v.roleIds,
    departmentIds: v.departmentIds,
  };
  // Sửa: để trống mật khẩu = giữ nguyên mật khẩu cũ.
  if (v.password || mode === "create") payload.password = v.password;
  return payload;
}

/** Lấy lỗi validate theo trường từ response BE ({ errors: { field: [msg] } }). */
export function extractServerErrors(error: any): { fieldErrors: FieldErrors; message: string } {
  const data = error?.response?.data;
  return {
    fieldErrors: (data?.errors ?? {}) as FieldErrors,
    message: data?.message || "Đã có lỗi xảy ra, vui lòng thử lại.",
  };
}
