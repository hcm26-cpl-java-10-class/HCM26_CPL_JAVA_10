import { userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import type { UserDTO } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserForm } from "../components/UserForm";
import {
  extractDetailedServerError,
  toUserPayload,
  type UserFormData,
} from "../user-form.utils";

export function UserCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: UserDTO) => userApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("Tạo người dùng thành công.");
      navigate("/users");
    },
    onError: (error: unknown, payload) => {
      console.log("Payload FE gửi:", payload);
      toast.error(extractDetailedServerError(error));
    },
  });

  const handleSubmit = (data: UserFormData) => {
    createMutation.mutate(toUserPayload(data, null));
  };

  return (
    <MainLayout pathName={{ users: "Người dùng", create: "Tạo mới" }}>
      <UserForm
        mode="CREATE"
        initialData={null}
        onSubmit={handleSubmit}
        onClose={() => navigate("/users")}
        isSubmitting={createMutation.isPending}
      />
    </MainLayout>
  );
}
