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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GENDER_OPTIONS, USER_STATUS_DOT_CLASS, USER_STATUS_OPTIONS, type FieldSchema, type RelationConfig } from "@/types";
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
const deptField = { name: "departmentIds", label: "Ph├▓ng ban", type: "relation" } as FieldSchema;

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

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto grid w-full max-w-5xl gap-5">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-5 text-sm font-semibold">Th├┤ng tin t├ái khoß║ún</h3>

        <div className="grid gap-5 md:grid-cols-2">
          <Field id="user-lastName" label="Hß╗ì ─æß╗çm" errors={errors.lastName}>
            {text("lastName", "user-lastName", "Nguyß╗àn V─ân")}
          </Field>
          <Field id="user-firstName" label="T├¬n" required errors={errors.firstName}>
            {text("firstName", "user-firstName", "An")}
          </Field>
          <Field id="user-username" label="Username" required errors={errors.username}>
            {text("username", "user-username", "an.nv")}
          </Field>
          <Field id="user-employeeCode" label="M├ú nh├ón vi├¬n" required errors={errors.employeeCode}>
            {text("employeeCode", "user-employeeCode", "NV0001")}
          </Field>
          <Field id="user-email" label="Email" required errors={errors.email}>
            {text("email", "user-email", "an.nv@company.com", "email")}
          </Field>
          <Field id="user-phone" label="Sß╗æ ─æiß╗çn thoß║íi" errors={errors.phone}>
            {text("phone", "user-phone", "0901234567", "tel")}
          </Field>
          <Field id="user-dateOfBirth" label="Ng├áy sinh (yyyy-MM-dd)" required={mode === "create"} errors={errors.dateOfBirth}>
            {text("dateOfBirth", "user-dateOfBirth", "2000-01-31")}
          </Field>
          <Field id="user-gender" label="Giß╗¢i t├¡nh" required={mode === "create"} errors={errors.gender}>
            <Select value={values.gender} onValueChange={(v) => onChange("gender", v as UserFormValues["gender"])}>
              <SelectTrigger id="user-gender" className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="user-password"
            label={mode === "create" ? "Mß║¡t khß║⌐u" : "Mß║¡t khß║⌐u mß╗¢i"}
            required={mode === "create"}
            errors={errors.password}
          >
            {text(
              "password",
              "user-password",
              mode === "create" ? "Tß╗æi thiß╗âu 8 k├╜ tß╗▒" : "─Éß╗â trß╗æng nß║┐u kh├┤ng ─æß╗òi",
              "password",
            )}
          </Field>
          <Field id="user-confirmPassword" label="X├íc nhß║¡n mß║¡t khß║⌐u" errors={errors.confirmPassword}>
            {text("confirmPassword", "user-confirmPassword", "Nhß║¡p lß║íi mß║¡t khß║⌐u", "password")}
          </Field>
          <Field id="user-status" label="Trß║íng th├íi" errors={errors.status}>
            <Select value={values.status} onValueChange={(v) => onChange("status", v as UserFormValues["status"])}>
              <SelectTrigger id="user-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Chß╗ë cho chß╗ìn Hoß║ít ─æß╗Öng / Bß╗ï kh├│a; "Ng╞░ng hoß║ít ─æß╗Öng" chß╗ë hiß╗çn khi t├ái khoß║ún c┼⌐ ─æang ß╗ƒ trß║íng th├íi ─æ├│. */}
                {USER_STATUS_OPTIONS.filter((o) => o.value !== "INACTIVE" || values.status === "INACTIVE").map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", USER_STATUS_DOT_CLASS[o.value])} />
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <MultiRelationSelect
            field={roleField}
            rel={roleRel}
            items={roles}
            value={values.roleIds}
            errorClass={errCls(errors.roleIds)}
            fieldErrors={errors.roleIds}
            onChange={(v) => onChange("roleIds", v)}
          />
          <div className="md:col-span-2">
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
          <div className="md:col-span-2">
            <Field id="user-description" label="M├┤ tß║ú" errors={errors.description}>
              <Textarea
                id="user-description"
                rows={4}
                value={values.description}
                placeholder="Ghi ch├║ vß╗ü ng╞░ß╗¥i d├╣ng"
                onChange={(e) => onChange("description", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <CardFooter className="flex justify-end gap-2 px-0 pt-0">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          <ArrowLeft className="h-4 w-4" />
          Quay lß║íi
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="h-4 w-4" />
          {submitting ? "─Éang l╞░u..." : mode === "create" ? "Tß║ío ng╞░ß╗¥i d├╣ng" : "L╞░u thay ─æß╗òi"}
        </Button>
      </CardFooter>
    </form>
  );
}
