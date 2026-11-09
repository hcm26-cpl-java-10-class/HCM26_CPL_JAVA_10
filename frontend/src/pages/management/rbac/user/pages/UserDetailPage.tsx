import { departmentApi, roleApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GENDER_OPTIONS,
  USER_STATUS_HEADER_CLASS,
  type DepartmentDTO,
  type RoleDTO,
  type UserAccountStatus,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AtSign,
  Building2,
  Cake,
  CalendarDays,
  Clock,
  FileText,
  Hash,
  Mail,
  PenSquare,
  Phone,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
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
  const nameOf = (list: Array<Pick<RoleDTO | DepartmentDTO, "id" | "name">> | undefined, ids?: Array<string | number>) =>
    (ids ?? []).map((i) => list?.find((x) => String(x.id) === String(i))?.name ?? `#${i}`);

  const roleNames = nameOf(roleQuery.data?.content ?? roleQuery.data?.items, user?.roleIds);
  const deptNames = nameOf(deptQuery.data?.content ?? deptQuery.data?.items, user?.departmentIds);
  const fullName = [user?.lastName, user?.firstName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email || "";
  const status: UserAccountStatus = user?.status ?? (user?.isActive === false ? "INACTIVE" : "ACTIVE");
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

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

                <Section title="Thông tin tài khoản">
                  <InfoRow icon={AtSign} label="Username">
                    {user?.username}
                  </InfoRow>
                  <InfoRow icon={Hash} label="Mã nhân viên">
                    {user?.employeeCode}
                  </InfoRow>
                  <InfoRow icon={Mail} label="Email">
                    {user?.email}
                  </InfoRow>
                  <InfoRow icon={Phone} label="Số điện thoại">
                    {user?.phone}
                  </InfoRow>
                  <InfoRow icon={Cake} label="Ngày sinh">
                    {user?.dateOfBirth}
                  </InfoRow>
                  <InfoRow icon={UserRound} label="Giới tính">
                    {GENDER_OPTIONS.find((o) => o.value === user?.gender)?.label}
                  </InfoRow>
                  <InfoRow icon={Building2} label="Phòng ban" className="sm:col-span-2">
                    {deptNames.length > 0 ? <BadgeGroup names={deptNames} /> : null}
                  </InfoRow>
                  <InfoRow icon={ShieldCheck} label="Role" className="sm:col-span-2">
                    {roleNames.length > 0 ? <BadgeGroup names={roleNames} /> : null}
                  </InfoRow>
                  <InfoRow icon={FileText} label="Mô tả" className="sm:col-span-2">
                    {user?.description ? <p className="whitespace-pre-line font-normal leading-6">{user.description}</p> : null}
                  </InfoRow>
                </Section>

                <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-xs text-muted-foreground">
                  <MetaItem icon={CalendarDays} label="Ngày tạo" value={formatDate(user?.createdAt) || "—"} />
                  <MetaItem icon={Clock} label="Cập nhật lần cuối" value={formatDate(user?.updatedAt) || "—"} />
                  {user?.lastLoginAt && (
                    <MetaItem icon={Clock} label="Đăng nhập gần nhất" value={formatDate(user.lastLoginAt)} />
                  )}
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
