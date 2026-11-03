import { departmentApi, roleApi, userApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DepartmentDTO, RoleDTO, User, UserStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { UserFormData } from "../user-form.utils";

type UserFormMode = "CREATE" | "EDIT";
type UserFormValues = UserFormData & { skillsInput: string };
type UserFormErrors = Partial<Record<keyof UserFormValues | "roles", string>>;

interface RoleOption {
  id: string;
  name: string;
  roleCode?: string;
}

interface UserFormProps {
  mode: UserFormMode;
  initialData: User | null;
  onSubmit: (data: UserFormData) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

const CREATED_ROLES_STORAGE_KEY = "FAMS_CREATED_ROLES";
const FALLBACK_ROLE_OPTIONS: RoleOption[] = [
  { id: "ADMIN", name: "ADMIN", roleCode: "ADMIN" },
  { id: "TEACHER", name: "TEACHER", roleCode: "TEACHER" },
  { id: "STUDENT", name: "STUDENT", roleCode: "STUDENT" },
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

const normalizeRoleCode = (value?: string) =>
  value?.trim().toUpperCase().replace(/^ROLE_/, "") ?? "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readCreatedRoleOptions(): RoleOption[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(CREATED_ROLES_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error(`Invalid localStorage data for ${CREATED_ROLES_STORAGE_KEY}.`);
      return [];
    }

    return parsed.flatMap((item): RoleOption[] => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
        return [];
      }
      if (item.roleCode !== undefined && typeof item.roleCode !== "string") return [];
      return [{
        id: item.id,
        name: item.name,
        roleCode: item.roleCode,
      }];
    });
  } catch (error) {
    console.error(`Could not read localStorage data for ${CREATED_ROLES_STORAGE_KEY}.`, error);
    return [];
  }
}

function mergeRoleOptions(options: RoleOption[]): RoleOption[] {
  const merged: RoleOption[] = [];
  for (const option of options) {
    const normalizedId = normalizeRoleCode(option.id);
    const normalizedCode = normalizeRoleCode(option.roleCode ?? option.name);
    const duplicate = merged.some(
      (existing) =>
        normalizeRoleCode(existing.id) === normalizedId ||
        normalizeRoleCode(existing.roleCode ?? existing.name) === normalizedCode,
    );
    if (!duplicate) merged.push(option);
  }
  return merged;
}

function getRoleOptionLabel(option: RoleOption): string {
  const normalizedCode = normalizeRoleCode(option.roleCode ?? option.name);
  if (normalizedCode === "ADMIN") return "ADMIN (Quản trị viên)";
  if (["TEACHER", "TRAINER"].includes(normalizedCode)) {
    return "TEACHER / TRAINER (Giảng viên)";
  }
  if (["STUDENT", "TRAINEE"].includes(normalizedCode)) {
    return "STUDENT / TRAINEE (Học viên)";
  }
  return option.roleCode
    ? `${option.name} (${option.roleCode})`
    : option.name;
}

const toInitialValues = (user: User | null): UserFormValues => ({
  fullName: [user?.lastName, user?.firstName].filter(Boolean).join(" "),
  username: user?.username ?? "",
  email: user?.email ?? "",
  employeeCode: user?.employeeCode ?? "",
  roles: [],
  roleIds: (user?.roleIds ?? []).map(String),
  departmentIds: (user?.departmentIds ?? []).map(String),
  status: user?.status === "INACTIVE" || user?.isActive === false ? "INACTIVE" : "ACTIVE",
  skills: user?.skills ?? [],
  skillsInput: "",
  description: user?.description ?? "",
});

function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function MultiSelectField({
  id,
  placeholder,
  options,
  selected,
  onSelect,
  onRemove,
  disabled,
}: {
  id: string;
  placeholder: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const availableOptions = options.filter((option) => !selected.includes(option.id));

  return (
    <div className="grid gap-2">
      <Select value="" onValueChange={onSelect} disabled={disabled || availableOptions.length === 0}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
          <ChevronDown className="ml-auto size-4 text-slate-400" />
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const option = options.find((item) => item.id === id);
            return (
              <Badge
                key={id}
                variant="outline"
                className="gap-1 border-orange-200 bg-orange-50 text-orange-800"
              >
                {option?.label ?? `#${id}`}
                <button
                  type="button"
                  aria-label={`Bỏ ${option?.label ?? id}`}
                  onClick={() => onRemove(id)}
                  className="rounded-full hover:text-red-600"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserFormContent({
  mode,
  initialData,
  onSubmit,
  onClose,
  isSubmitting = false,
}: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(() => toInitialValues(initialData));
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [rolesTouched, setRolesTouched] = useState(false);
  const [createdRoleOptions] = useState<RoleOption[]>(readCreatedRoleOptions);

  const rolesQuery = useQuery({
    queryKey: ["role", "options"],
    queryFn: () => roleApi.getPage({ page: 0, size: 200 }),
  });
  const departmentsQuery = useQuery({
    queryKey: ["department", "options"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
  });
  const usersQuery = useQuery({
    queryKey: ["user", "code-validation"],
    queryFn: () => userApi.getPage({ page: 0, size: 1000 }),
  });

  const roles: RoleDTO[] = rolesQuery.data?.content ?? rolesQuery.data?.items ?? [];
  const departments: DepartmentDTO[] =
    departmentsQuery.data?.content ?? departmentsQuery.data?.items ?? [];
  const apiRoleOptions = roles.flatMap((role): RoleOption[] =>
    role.id === undefined
      ? []
      : [{
          id: String(role.id),
          name: role.name ?? `Role #${role.id}`,
          roleCode: role.name,
        }],
  );
  const roleOptions = mergeRoleOptions([
    ...apiRoleOptions,
    ...FALLBACK_ROLE_OPTIONS,
    ...createdRoleOptions,
  ]).map((option) => ({
    ...option,
    label: getRoleOptionLabel(option),
  }));
  const selectedRoles =
    rolesTouched || values.roles.length > 0
      ? values.roles
      : values.roleIds.map(String);
  const departmentOptions = departments.flatMap((department) =>
    department.id === undefined
      ? []
      : [{ id: String(department.id), label: department.name ?? `Phòng ban #${department.id}` }],
  );

  const updateValue = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const addSkill = () => {
    const skill = values.skillsInput.trim();
    if (!skill || values.skills.some((item) => item.toLocaleLowerCase() === skill.toLocaleLowerCase())) {
      updateValue("skillsInput", "");
      return;
    }
    setValues((current) => ({
      ...current,
      skills: [...current.skills, skill],
      skillsInput: "",
    }));
  };

  const handleSkillKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill();
    }
  };

  const code = values.employeeCode.trim().toLocaleLowerCase();
  const matchingUser = (usersQuery.data?.content ?? usersQuery.data?.items ?? []).find(
    (user) =>
      user.employeeCode?.trim().toLocaleLowerCase() === code &&
      String(user.id ?? "") !== String(initialData?.id ?? ""),
  );
  const hasValidRequiredFields =
    Boolean(values.fullName.trim()) &&
    USERNAME_PATTERN.test(values.username.trim()) &&
    EMAIL_PATTERN.test(values.email.trim()) &&
    selectedRoles.length > 0 &&
    values.departmentIds.length > 0;
  const codeIsUnique =
    !code ||
    (usersQuery.isSuccess && !matchingUser) ||
    (mode === "EDIT" && code === initialData?.employeeCode?.trim().toLocaleLowerCase());
  const permissionScopeIsValid =
    !rolesQuery.isLoading &&
    !departmentsQuery.isLoading &&
    selectedRoles.length > 0 &&
    selectedRoles.every((id) => roleOptions.some((option) => option.id === id)) &&
    values.departmentIds.length > 0 &&
    values.departmentIds.every((id) => departmentOptions.some((department) => department.id === id));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: UserFormErrors = {};
    const fullName = values.fullName.trim();
    const username = values.username.trim();
    const email = values.email.trim();
    const employeeCode =
      values.employeeCode.trim() || `NV${Date.now().toString().slice(-6)}`;
    const normalizedEmployeeCode = employeeCode.toLocaleLowerCase();
    const matchingSubmittedUser = (
      usersQuery.data?.content ?? usersQuery.data?.items ?? []
    ).find(
      (user) =>
        user.employeeCode?.trim().toLocaleLowerCase() === normalizedEmployeeCode &&
        String(user.id ?? "") !== String(initialData?.id ?? ""),
    );

    if (!fullName) nextErrors.fullName = "Họ và tên là bắt buộc.";
    if (!username) nextErrors.username = "Username là bắt buộc.";
    else if (!USERNAME_PATTERN.test(username)) {
      nextErrors.username = "Username cần từ 3-50 ký tự (chữ, số, dấu chấm, gạch dưới hoặc gạch ngang).";
    }
    if (!email) nextErrors.email = "Email là bắt buộc.";
    else if (!EMAIL_PATTERN.test(email)) nextErrors.email = "Email không đúng định dạng.";
    if (selectedRoles.length === 0) nextErrors.roles = "Vui lòng chọn ít nhất một role.";
    else if (rolesQuery.isLoading) {
      nextErrors.roles = "Đang tải danh sách vai trò. Vui lòng thử lại.";
    } else if (
      rolesQuery.isError ||
      selectedRoles.some((selectedRoleId) =>
        !roleOptions.some((option) => option.id === selectedRoleId),
      )
    ) {
      nextErrors.roles = "Không thể xác minh ID của vai trò đã chọn. Vui lòng thử lại.";
    }
    if (values.departmentIds.length === 0) {
      nextErrors.departmentIds = "Vui lòng chọn ít nhất một phòng ban.";
    } else if (
      values.departmentIds.some((id) => !departmentOptions.some((department) => department.id === id)) ||
      departmentsQuery.isError
    ) {
      nextErrors.departmentIds = "Không thể xác minh phòng ban đã chọn. Vui lòng tải lại danh sách.";
    }
    if (matchingSubmittedUser) nextErrors.employeeCode = "Mã NV/HV đã được sử dụng.";
    if (usersQuery.isError && code) {
      nextErrors.employeeCode = "Không thể kiểm tra mã NV/HV. Vui lòng thử lại.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      fullName,
      username,
      email,
      employeeCode,
      roleIds: selectedRoles.filter((id, index, ids) => ids.indexOf(id) === index),
      roles: selectedRoles.flatMap((id) => {
        const role = roleOptions.find((option) => option.id === id);
        return role ? [role.roleCode ?? role.name] : [];
      }),
      departmentIds: values.departmentIds,
      status: values.status,
      skills: values.skills,
      description: values.description.trim(),
    });
  };

  const checklist = [
    { label: "Các trường bắt buộc đã hợp lệ", valid: hasValidRequiredFields },
    { label: "Không phát hiện mã trùng", valid: codeIsUnique && !usersQuery.isError },
    { label: "Quyền và phạm vi hợp lệ", valid: permissionScopeIsValid },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-3 text-sm text-slate-500">
              <ol className="flex flex-wrap items-center gap-2">
                <li>FAMS &amp; LMS</li>
                <li aria-hidden="true">/</li>
                <li>System</li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-slate-700">Tạo / sửa người dùng</li>
              </ol>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Tạo / sửa người dùng
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý dữ liệu và quy trình theo quyền được cấp
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="bg-orange-600 text-white hover:bg-orange-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden border-slate-200 shadow-sm xl:col-span-2">
            <Tabs defaultValue="general">
              <div className="overflow-x-auto border-b border-slate-200 px-5 pt-4">
                <TabsList
                  variant="line"
                  className="h-auto min-w-max gap-6 rounded-none p-0 text-slate-500"
                >
                  <TabsTrigger
                    value="general"
                    className="flex-none rounded-none px-1 pb-3 data-[state=active]:text-orange-700 after:bg-orange-600"
                  >
                    Thông tin chung
                  </TabsTrigger>
                  <TabsTrigger
                    value="access"
                    className="flex-none rounded-none px-1 pb-3 data-[state=active]:text-orange-700 after:bg-orange-600"
                  >
                    Phân quyền &amp; nguồn lực
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="flex-none rounded-none px-1 pb-3 data-[state=active]:text-orange-700 after:bg-orange-600"
                  >
                    Lịch sử
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="p-5 sm:p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-slate-900">Thông tin người dùng</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Các trường có dấu * là bắt buộc.
                  </p>
                </div>

                <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
                  <FormField id="user-full-name" label="Họ và tên" required error={errors.fullName}>
                    <Input
                      id="user-full-name"
                      value={values.fullName}
                      onChange={(event) => updateValue("fullName", event.target.value)}
                      placeholder="Nhập họ và tên"
                      aria-invalid={Boolean(errors.fullName)}
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField id="user-username" label="Username" required error={errors.username}>
                    <Input
                      id="user-username"
                      value={values.username}
                      onChange={(event) => updateValue("username", event.target.value)}
                      placeholder="vd: nguyen.van.a"
                      aria-invalid={Boolean(errors.username)}
                      autoComplete="username"
                    />
                  </FormField>

                  <FormField id="user-email" label="Email" required error={errors.email}>
                    <Input
                      id="user-email"
                      type="email"
                      value={values.email}
                      onChange={(event) => updateValue("email", event.target.value)}
                      placeholder="name@fams.edu.vn"
                      aria-invalid={Boolean(errors.email)}
                      autoComplete="email"
                    />
                  </FormField>
                  <FormField
                    id="user-employee-code"
                    label="Employee code (Mã NV/HV)"
                    required
                    error={errors.employeeCode}
                  >
                    <Input
                      id="user-employee-code"
                      value={values.employeeCode}
                      disabled={mode === "EDIT"}
                      onChange={(event) => updateValue("employeeCode", event.target.value)}
                      placeholder="Nhập mã nhân viên / học viên"
                      aria-invalid={Boolean(errors.employeeCode)}
                    />
                  </FormField>

                  <FormField id="user-roles" label="Roles" required error={errors.roles}>
                    <MultiSelectField
                      id="user-roles"
                      placeholder={rolesQuery.isLoading ? "Đang tải vai trò..." : "Chọn vai trò"}
                      options={roleOptions}
                      selected={selectedRoles}
                      onSelect={(id) => {
                        if (!roleOptions.some((option) => option.id === id)) return;
                        setRolesTouched(true);
                        updateValue("roles", [...selectedRoles, id]);
                      }}
                      onRemove={(id) => {
                        if (!selectedRoles.includes(id)) return;
                        setRolesTouched(true);
                        updateValue(
                          "roles",
                          selectedRoles.filter((selectedRoleId) => selectedRoleId !== id),
                        );
                      }}
                    />
                    {rolesQuery.isError && (
                      <p className="text-xs text-amber-700">
                        Không tải được danh sách vai trò. Các lựa chọn mặc định vẫn hiển thị; cần tải lại dữ liệu để lưu bằng ID hợp lệ.
                      </p>
                    )}
                  </FormField>
                  <FormField
                    id="user-departments"
                    label="Departments"
                    required
                    error={errors.departmentIds}
                  >
                    <MultiSelectField
                      id="user-departments"
                      placeholder={departmentsQuery.isLoading ? "Đang tải phòng ban..." : "Chọn phòng ban"}
                      options={departmentOptions}
                      selected={values.departmentIds}
                      onSelect={(id) =>
                        updateValue("departmentIds", [...values.departmentIds, id])
                      }
                      onRemove={(id) =>
                        updateValue(
                          "departmentIds",
                          values.departmentIds.filter((selectedId) => selectedId !== id),
                        )
                      }
                      disabled={departmentsQuery.isLoading || departmentsQuery.isError}
                    />
                    {departmentsQuery.isError && (
                      <p className="text-xs text-red-600">Không tải được danh sách phòng ban.</p>
                    )}
                  </FormField>

                  <FormField id="user-status" label="Trạng thái">
                    <Select
                      value={values.status}
                      onValueChange={(status: UserStatus) => updateValue("status", status)}
                    >
                      <SelectTrigger id="user-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="user-skills" label="Kỹ năng">
                    <div className="grid gap-2">
                      <Input
                        id="user-skills"
                        value={values.skillsInput}
                        onChange={(event) => updateValue("skillsInput", event.target.value)}
                        onKeyDown={handleSkillKeyDown}
                        onBlur={addSkill}
                        placeholder="Nhập kỹ năng, nhấn Enter để thêm"
                      />
                      {values.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {values.skills.map((skill) => (
                            <Badge
                              key={skill}
                              variant="outline"
                              className="gap-1 border-slate-200 bg-slate-50 text-slate-700"
                            >
                              {skill}
                              <button
                                type="button"
                                aria-label={`Bỏ kỹ năng ${skill}`}
                                onClick={() =>
                                  updateValue(
                                    "skills",
                                    values.skills.filter((item) => item !== skill),
                                  )
                                }
                                className="rounded-full hover:text-red-600"
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormField>

                  <div className="md:col-span-2">
                    <FormField id="user-description" label="Mô tả / ghi chú">
                      <Textarea
                        id="user-description"
                        rows={4}
                        value={values.description}
                        onChange={(event) => updateValue("description", event.target.value)}
                        placeholder="Nhập mô tả hoặc ghi chú về người dùng"
                      />
                    </FormField>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="access" className="p-5 sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">Phân quyền &amp; nguồn lực</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vai trò và phòng ban được quản lý trong tab Thông tin chung.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Roles</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((role) => (
                          <Badge key={role} variant="outline">
                            {roleOptions.find((option) => option.id === role)?.label ?? role}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Chưa phân quyền</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Departments
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {values.departmentIds.length > 0 ? (
                        values.departmentIds.map((id) => (
                          <Badge key={id} variant="outline">
                            {departmentOptions.find((department) => department.id === id)?.label ??
                              `#${id}`}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Chưa chọn phòng ban</p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="p-5 sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">Lịch sử thay đổi</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Audit log sẽ được ghi nhận sau khi lưu thông tin người dùng.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          <aside className="space-y-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Kiểm tra dữ liệu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span
                      className={
                        item.valid
                          ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                          : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                      }
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span className={item.valid ? "text-sm text-slate-700" : "text-sm text-slate-500"}>
                      {item.label}
                    </span>
                  </div>
                ))}
                {usersQuery.isLoading && code && (
                  <p className="text-xs text-slate-500">Đang kiểm tra mã NV/HV...</p>
                )}
                {usersQuery.isError && code && (
                  <p className="text-xs text-amber-700">Chưa thể xác minh mã NV/HV lúc này.</p>
                )}
                {matchingUser && (
                  <p className="text-xs text-red-600">Mã NV/HV này đã được sử dụng.</p>
                )}
              </CardContent>
            </Card>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-800">
                Thay đổi sẽ được ghi vào audit log sau khi lưu.
              </p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

export function UserForm(props: UserFormProps) {
  const formKey = `${props.mode}-${props.initialData?.id ?? "new"}`;
  return <UserFormContent key={formKey} {...props} />;
}
