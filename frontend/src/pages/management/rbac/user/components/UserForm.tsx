import { departmentApi, roleApi } from "@/api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { MultiRelationSelect } from "@/components/datatable/modal/form/MultiRelationSelect";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
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
import { USER_STATUS_OPTIONS, type FieldSchema, type RelationConfig } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { FieldErrors, UserFormValues } from "../user-form.utils";

interface UserFormProps {
  mode: "create" | "edit";
  values: UserFormValues;
  errors: FieldErrors;
  submitting: boolean;
  onChange: <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const roleRel: RelationConfig = { api: roleApi, valueField: "id", labelField: "name", multiple: true };
const deptRel: RelationConfig = { api: departmentApi, valueField: "id", labelField: "name", multiple: true };

const roleField = { name: "roleIds", label: "Role", type: "relation" } as FieldSchema;
const deptField = { name: "departmentIds", label: "Phòng ban", type: "relation" } as FieldSchema;

const errCls = (errs?: string[]) => (errs && errs.length ? "border-destructive" : "");

function Field({
  id,
  label,
  required,
  errors,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      <FieldError errors={errors} />
    </div>
  );
}

export function UserForm({ mode, values, errors, submitting, onChange, onSubmit, onCancel }: UserFormProps) {
  const roleQuery = useQuery({
    queryKey: ["role", "options"],
    queryFn: () => roleApi.getPage({ page: 0, size: 200 }),
  });
  const deptQuery = useQuery({
    queryKey: ["department", "options"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
  });

  const roles = roleQuery.data?.content ?? roleQuery.data?.items ?? [];
  const departments = deptQuery.data?.content ?? deptQuery.data?.items ?? [];

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  const text = (key: keyof UserFormValues, id: string, placeholder?: string, type = "text") => (
    <Input
      id={id}
      type={type}
      value={values[key] as string}
      placeholder={placeholder}
      className={errCls(errors[key])}
      onChange={(e) => onChange(key, e.target.value as never)}
    />
  );

  const generalHasError = (
    ["firstName", "lastName", "username", "email", "employeeCode", "phone", "password", "confirmPassword", "departmentIds", "status", "description"] as const
  ).some((k) => errors[k]?.length);
  const authHasError = !!errors.roleIds?.length;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Tabs defaultValue="general" className="grid gap-5">
        <TabsList>
          <TabsTrigger value="general" className={generalHasError ? "text-destructive" : ""}>
            Thông tin chung{generalHasError && " •"}
          </TabsTrigger>
          <TabsTrigger value="authorization" className={authHasError ? "text-destructive" : ""}>
            Phân quyền{authHasError && " •"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="user-lastName" label="Họ đệm" errors={errors.lastName}>
              {text("lastName", "user-lastName", "Nguyễn Văn")}
            </Field>
            <Field id="user-firstName" label="Tên" required errors={errors.firstName}>
              {text("firstName", "user-firstName", "An")}
            </Field>
            <Field id="user-username" label="Username" required errors={errors.username}>
              {text("username", "user-username", "an.nv")}
            </Field>
            <Field id="user-employeeCode" label="Mã nhân viên" required errors={errors.employeeCode}>
              {text("employeeCode", "user-employeeCode", "NV0001")}
            </Field>
            <Field id="user-email" label="Email" required errors={errors.email}>
              {text("email", "user-email", "an.nv@company.com", "email")}
            </Field>
            <Field id="user-phone" label="Số điện thoại" errors={errors.phone}>
              {text("phone", "user-phone", "0901234567", "tel")}
            </Field>
            <Field
              id="user-password"
              label={mode === "create" ? "Mật khẩu" : "Mật khẩu mới"}
              required={mode === "create"}
              errors={errors.password}
            >
              {text(
                "password",
                "user-password",
                mode === "create" ? "Tối thiểu 8 ký tự" : "Để trống nếu không đổi",
                "password",
              )}
            </Field>
            <Field id="user-confirmPassword" label="Xác nhận mật khẩu" errors={errors.confirmPassword}>
              {text("confirmPassword", "user-confirmPassword", "Nhập lại mật khẩu", "password")}
            </Field>
            <Field id="user-status" label="Trạng thái" errors={errors.status}>
              <Select value={values.status} onValueChange={(v) => onChange("status", v as UserFormValues["status"])}>
                <SelectTrigger id="user-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <MultiRelationSelect
              field={deptField}
              rel={deptRel}
              items={departments}
              value={values.departmentIds}
              errorClass={errCls(errors.departmentIds)}
              fieldErrors={errors.departmentIds}
              onChange={(v) => onChange("departmentIds", v)}
            />
          </div>
          <Field id="user-description" label="Mô tả" errors={errors.description}>
            <Textarea
              id="user-description"
              rows={4}
              value={values.description}
              placeholder="Ghi chú về người dùng"
              onChange={(e) => onChange("description", e.target.value)}
            />
          </Field>
        </TabsContent>

        <TabsContent value="authorization" className="grid gap-5">
          <p className="text-sm text-muted-foreground">
            Người dùng có thể giữ nhiều role; quyền hiệu lực là hợp của các role được gán.
          </p>
          <div className="max-w-xl">
            <MultiRelationSelect
              field={roleField}
              rel={roleRel}
              items={roles}
              value={values.roleIds}
              errorClass={errCls(errors.roleIds)}
              fieldErrors={errors.roleIds}
              onChange={(v) => onChange("roleIds", v)}
            />
          </div>
        </TabsContent>

        <CardFooter className="flex justify-end gap-2 px-0 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save className="h-4 w-4" />
            {submitting ? "Đang lưu..." : mode === "create" ? "Tạo người dùng" : "Lưu thay đổi"}
          </Button>
        </CardFooter>
      </Tabs>
    </form>
  );
}
