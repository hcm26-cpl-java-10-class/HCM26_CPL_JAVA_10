import { userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { UserForm } from "../components/UserForm";
import {
  extractDetailedServerError,
  extractServerErrors,
  toUserPayload,
  type UserFormData,
} from "../user-form.utils";

export function UserEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const userQuery = useQuery({
    queryKey: ["user", "detail", id],
    queryFn: () => {
      if (!id) throw new Error("Không xác định được người dùng cần chỉnh sửa.");
      return userApi.getById(id);
    },
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UserDTO) => {
      if (!id) throw new Error("Không xác định được người dùng cần chỉnh sửa.");
      return userApi.update(id, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: ["user", "detail", id] }),
      ]);
      toast.success("Cập nhật người dùng thành công.");
      navigate("/users");
    },
    onError: (error: unknown, payload) => {
      console.log("Payload FE gửi:", payload);
      toast.error(extractDetailedServerError(error));
    },
  });

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
      {userQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu người dùng...</p>
      ) : userQuery.isError ? (
        <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{extractServerErrors(userQuery.error).message}</p>
          <Button variant="outline" onClick={() => navigate("/users")}>
            Về danh sách
          </Button>
        </div>
      ) : userQuery.data ? (
        <UserForm
          mode="EDIT"
          initialData={userQuery.data}
          onSubmit={(data: UserFormData) =>
            updateMutation.mutate(toUserPayload(data, userQuery.data))
          }
          onClose={() => navigate("/users")}
          isSubmitting={updateMutation.isPending}
        />
      ) : null}
    </MainLayout>
  );
}
