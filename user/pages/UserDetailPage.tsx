import { departmentApi, roleApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USER_STATUS_OPTIONS, type UserStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PenSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { extractServerErrors } from "../user-form.utils";

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

const STATUS_VARIANT: Record<UserStatus, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  LOCKED: "destructive",
  INACTIVE: "secondary",
};

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="font-medium text-muted-foreground">{label}</span>
      <div>{children || "-"}</div>
    </div>
  );
}

function BadgeGroup({ names }: { names: string[] }) {
  if (names.length === 0) return <span>-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((n) => (
        <Badge key={n} variant="secondary">
          {n}
        </Badge>
      ))}
    </div>
  );
}

export function UserDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pathName = { users: "Người dùng", detail: "Chi tiết" };

  const userQuery = useQuery({
    queryKey: ["user", "detail", id],
    queryFn: () => userApi.getById(id as string),
    enabled: !!id,
  });
  const roleQuery = useQuery({
    queryKey: ["role", "options"],
    queryFn: () => roleApi.getPage({ page: 0, size: 200 }),
  });
  const deptQuery = useQuery({
    queryKey: ["department", "options"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
  });

  const user = userQuery.data;
  const nameOf = (list: any[] | undefined, ids?: Array<string | number>) =>
    (ids ?? []).map((i) => list?.find((x) => String(x.id) === String(i))?.name ?? `#${i}`);

  const roleNames = nameOf(roleQuery.data?.content ?? roleQuery.data?.items, user?.roleIds);
  const deptNames = nameOf(deptQuery.data?.content ?? deptQuery.data?.items, user?.departmentIds);
  const fullName = [user?.lastName, user?.firstName].filter(Boolean).join(" ");
  const status: UserStatus = user?.status ?? (user?.isActive === false ? "INACTIVE" : "ACTIVE");
  const statusLabel = USER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

  return (
    <MainLayout pathName={pathName}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Chi tiết người dùng</CardTitle>
          <CardDescription>Thông tin chi tiết người dùng #{id}.</CardDescription>
        </CardHeader>

        {!id ? (
          <CardContent>
            <p className="text-sm text-destructive">Không xác định được người dùng cần xem.</p>
          </CardContent>
        ) : userQuery.isLoading ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </CardContent>
        ) : userQuery.isError ? (
          <CardContent>
            <p className="text-sm text-destructive">{extractServerErrors(userQuery.error).message}</p>
          </CardContent>
        ) : (
          <CardContent>
            <Tabs defaultValue="general" className="grid gap-5">
              <TabsList>
                <TabsTrigger value="general">Thông tin chung</TabsTrigger>
                <TabsTrigger value="authorization">Phân quyền</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="grid gap-4 text-sm md:grid-cols-2">
                <Item label="Họ tên">
                  <span className="text-base font-semibold">{fullName}</span>
                </Item>
                <Item label="Username">{user?.username}</Item>
                <Item label="Email">{user?.email}</Item>
                <Item label="Mã nhân viên">{user?.employeeCode}</Item>
                <Item label="Số điện thoại">{user?.phone}</Item>
                <Item label="Trạng thái">
                  <Badge variant={STATUS_VARIANT[status]}>{statusLabel}</Badge>
                </Item>
                <Item label="Phòng ban">
                  <BadgeGroup names={deptNames} />
                </Item>
                <Item label="Đăng nhập gần nhất">{formatDate(user?.lastLoginAt)}</Item>
                <div className="md:col-span-2">
                  <Item label="Mô tả">
                    <p className="leading-6">{user?.description}</p>
                  </Item>
                </div>
                <Item label="Ngày tạo">{formatDate(user?.createdAt)}</Item>
                <Item label="Cập nhật lần cuối">{formatDate(user?.updatedAt)}</Item>
              </TabsContent>

              <TabsContent value="authorization" className="grid gap-4 text-sm">
                <Item label="Roles">
                  <BadgeGroup names={roleNames} />
                </Item>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          {id && (
            <PermissionGate permission="USER_UPDATE">
              <Button asChild>
                <Link to={`/users/${id}/edit`}>
                  <PenSquare className="h-4 w-4" />
                  Chỉnh sửa
                </Link>
              </Button>
            </PermissionGate>
          )}
        </CardFooter>
      </Card>
    </MainLayout>
  );
}
