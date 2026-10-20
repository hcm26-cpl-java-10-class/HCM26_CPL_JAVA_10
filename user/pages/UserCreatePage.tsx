import { userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserDTO } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserForm } from "../components/UserForm";
import {
  emptyUserForm,
  extractServerErrors,
  toPayload,
  validateUserForm,
  type FieldErrors,
  type UserFormValues,
} from "../user-form.utils";

export function UserCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<UserFormValues>(emptyUserForm);
  const [errors, setErrors] = useState<FieldErrors>({});

  const createMutation = useMutation({
    mutationFn: (payload: UserDTO) => userApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("Tạo người dùng thành công.");
      navigate("/users");
    },
    onError: (error: any) => {
      const { fieldErrors, message } = extractServerErrors(error);
      setErrors(fieldErrors);
      toast.error(message);
    },
  });

  const handleChange = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = () => {
    const clientErrors = validateUserForm(values, "create");
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      toast.error("Vui lòng kiểm tra lại các trường bị lỗi.");
      return;
    }
    createMutation.mutate(toPayload(values, "create"));
  };

  return (
    <MainLayout pathName={{ users: "Người dùng", create: "Tạo mới" }}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Tạo người dùng</CardTitle>
          <CardDescription>Nhập thông tin chung và phân quyền cho người dùng mới.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            mode="create"
            values={values}
            errors={errors}
            submitting={createMutation.isPending}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/users")}
          />
        </CardContent>
      </Card>
    </MainLayout>
  );
}
