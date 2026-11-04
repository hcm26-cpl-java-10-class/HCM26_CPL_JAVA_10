import { userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { UserForm } from "../components/UserForm";
import {
  emptyUserForm,
  extractServerErrors,
  toFormValues,
  toPayload,
  validateUserForm,
  type FieldErrors,
  type UserFormValues,
} from "../user-form.utils";

export function UserEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [values, setValues] = useState<UserFormValues>(emptyUserForm);
  const [errors, setErrors] = useState<FieldErrors>({});

  const userQuery = useQuery({
    queryKey: ["user", "detail", id],
    queryFn: () => userApi.getById(id as string),
    enabled: !!id,
  });

  useEffect(() => {
    if (userQuery.data) setValues(toFormValues(userQuery.data));
  }, [userQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UserDTO) => userApi.update(id as string, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: ["user", "detail", id] }),
      ]);
      toast.success("Cập nhật người dùng thành công.");
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
    const clientErrors = validateUserForm(values, "edit");
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      toast.error("Vui lòng kiểm tra lại các trường bị lỗi.");
      return;
    }
    updateMutation.mutate({ ...userQuery.data, ...toPayload(values, "edit") });
  };

  const pathName = { users: "Người dùng", edit: "Chỉnh sửa" };

  if (!id) {
    return (
      <MainLayout pathName={pathName}>
        <Card>
          <CardHeader>
            <CardTitle>Thiếu mã người dùng</CardTitle>
            <CardDescription>Không xác định được người dùng cần chỉnh sửa.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate("/users")}>
              <ArrowLeft className="h-4 w-4" />
              Về danh sách
            </Button>
          </CardFooter>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout pathName={pathName}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Chỉnh sửa người dùng</CardTitle>
          <CardDescription>Cập nhật thông tin người dùng #{id}.</CardDescription>
        </CardHeader>
        <CardContent>
          {userQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          ) : userQuery.isError ? (
            <p className="text-sm text-destructive">
              {extractServerErrors(userQuery.error).message}
            </p>
          ) : (
            <UserForm
              mode="edit"
              values={values}
              errors={errors}
              submitting={updateMutation.isPending}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={() => navigate("/users")}
            />
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
