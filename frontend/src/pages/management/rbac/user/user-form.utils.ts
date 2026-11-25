import type { Gender, UserDTO } from "@/types";

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

/** Validate ph├¡a client; trß║ú vß╗ü lß╗ùi theo tß╗½ng tr╞░ß╗¥ng (rß╗ùng = hß╗úp lß╗ç). */
export function validateUserForm(v: UserFormValues, mode: "create" | "edit"): FieldErrors {
  const e: FieldErrors = {};
  const add = (k: keyof UserFormValues, msg: string) => (e[k] = [...(e[k] ?? []), msg]);

  if (!v.firstName.trim()) add("firstName", "Hß╗ì t├¬n l├á bß║»t buß╗Öc");
  if (!v.username.trim()) add("username", "Username l├á bß║»t buß╗Öc");
  else if (!USERNAME_RE.test(v.username.trim()))
    add("username", "Username 3-50 k├╜ tß╗▒, chß╗ë gß╗ôm chß╗», sß╗æ, . _ -");
  if (!v.email.trim()) add("email", "Email l├á bß║»t buß╗Öc");
  else if (!EMAIL_RE.test(v.email.trim())) add("email", "Email kh├┤ng hß╗úp lß╗ç");
  if (!v.employeeCode.trim()) add("employeeCode", "M├ú nh├ón vi├¬n l├á bß║»t buß╗Öc");
  if (v.phone.trim() && !PHONE_RE.test(v.phone.replace(/[\s.-]/g, "")))
    add("phone", "Sß╗æ ─æiß╗çn thoß║íi kh├┤ng hß╗úp lß╗ç");
  // Bß║»t buß╗Öc khi tß║ío mß╗¢i. Khi sß╗¡a, ─æß╗â trß╗æng = giß╗» nguy├¬n gi├í trß╗ï c┼⌐.
  const dob = v.dateOfBirth.trim();
  if (!dob) {
    if (mode === "create") add("dateOfBirth", "Ng├áy sinh l├á bß║»t buß╗Öc");
  } else if (!isValidIsoDate(dob)) add("dateOfBirth", "Ng├áy sinh phß║úi theo ─æß╗ïnh dß║íng yyyy-MM-dd, v├¡ dß╗Ñ 2000-01-31");
  else if (normalizeIsoDate(dob)! > new Date().toISOString().slice(0, 10))
    add("dateOfBirth", "Ng├áy sinh kh├┤ng ─æ╞░ß╗úc ß╗ƒ t╞░╞íng lai");
  if (!v.gender && mode === "create") add("gender", "Giß╗¢i t├¡nh l├á bß║»t buß╗Öc");

  if (mode === "create" && !v.password) add("password", "Mß║¡t khß║⌐u l├á bß║»t buß╗Öc");
  if (v.password && v.password.length < 8) add("password", "Mß║¡t khß║⌐u tß╗æi thiß╗âu 8 k├╜ tß╗▒");
  if (v.password && v.password !== v.confirmPassword)
    add("confirmPassword", "Mß║¡t khß║⌐u x├íc nhß║¡n kh├┤ng khß╗¢p");

  if (v.roleIds.length === 0) add("roleIds", "Chß╗ìn ├¡t nhß║Ñt 1 role");
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
    // INACTIVE mß╗¢i l├á isActive=false; LOCKED = isActive true + locked true (BE xß╗¡ l├╜ theo status).
    isActive: v.status !== "INACTIVE",
    roleIds: v.roleIds,
    departmentIds: v.departmentIds,
  };
  // Sß╗¡a: ─æß╗â trß╗æng mß║¡t khß║⌐u = giß╗» nguy├¬n mß║¡t khß║⌐u c┼⌐.
  if (v.password || mode === "create") payload.password = v.password;
  return payload;
}

/** Lß║Ñy lß╗ùi validate theo tr╞░ß╗¥ng tß╗½ response BE ({ errors: { field: [msg] } }). */
export function extractServerErrors(error: any): { fieldErrors: FieldErrors; message: string } {
  const data = error?.response?.data;
  return {
    fieldErrors: (data?.errors ?? {}) as FieldErrors,
    message: data?.message || "─É├ú c├│ lß╗ùi xß║úy ra, vui l├▓ng thß╗¡ lß║íi.",
  };
}
